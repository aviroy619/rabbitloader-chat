const mongoose = require('mongoose');

// Use environment variable with fallback
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/rabbitloader_chat';

// Message schema
const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  text: { type: String, required: true },
  content: { type: String }, // Support both text and content fields
  ts: { type: Date, default: Date.now },
  source: { type: String },      // e.g., "priority-qa", "kb", "admin-edits", "openai"
  edited: { type: Boolean, default: false },
  editor: { type: String }       // only if edited by admin
});

// Conversation schema - supporting both sessionId and conversationId
const ConversationSchema = new mongoose.Schema({
  sessionId: { type: String },
  conversationId: { type: String },
  userId: { type: String, required: true },
  domainId: { type: String },
  domain: { type: String }, // Support both domainId and domain
  messages: [MessageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes (explicit — no duplication now)
ConversationSchema.index({ sessionId: 1 }, { sparse: true });
ConversationSchema.index({ conversationId: 1 }, { sparse: true, unique: true });
ConversationSchema.index({ updatedAt: -1 });
ConversationSchema.index({ userId: 1, updatedAt: -1 });

const Conversation = mongoose.model('Conversation', ConversationSchema);

let mongoConnected = false;

// Initialize MongoDB connection
async function initMongo() {
  try {
   // console.log('Initializing MongoDB...');
    await mongoose.connect(MONGO_URI, {
      dbName: "rabbitloader-chat",
    });
    mongoConnected = true;
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.warn('MongoDB connection failed - running without conversation storage:', error.message);
    mongoConnected = false;
    // Don't throw error - let app continue without MongoDB
  }
}

async function closeMongo() {
  if (mongoConnected) {
    try {
      await mongoose.disconnect();
      console.log('MongoDB connection closed');
      mongoConnected = false;
    } catch (error) {
      console.error('Error closing MongoDB connection:', error);
    }
  }
}

// Legacy function for backwards compatibility
async function saveMessages(conversationId, userId, domain, messages) {
  if (!mongoConnected) {
    console.log('MongoDB not connected - skipping conversation save');
    return;
  }
  
  try {
    await Conversation.updateOne(
      { conversationId },
      {
        $setOnInsert: { userId, domain: domain || null },
        $push: { messages: { $each: messages } },
        $set: { updatedAt: new Date() }
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('MongoDB save error:', error);
  }
}

async function listConversations(limit = 20) {
  if (!mongoConnected) return [];
  return Conversation.find({})
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
}

async function getConversation(conversationId) {
  if (!mongoConnected) return null;
  return Conversation.findOne({ 
    $or: [
      { conversationId },
      { sessionId: conversationId }
    ]
  }).lean();
}

// Enhanced Conversations class
class Conversations {
   static async saveMessages(sessionId, userId, domainId, userMsg, assistantMsg, source = 'kb') {
    if (!mongoConnected) {
      console.log('MongoDB not connected - skipping conversation save');
      return { acknowledged: false };
    }

    try {
      const convId = sessionId || `conv_${new Date().getTime()}`;

      const messages = [
        { role: 'user', text: userMsg, content: userMsg, ts: new Date() },
        { role: 'assistant', text: assistantMsg, content: assistantMsg, ts: new Date(), source: source }
      ];

      const result = await Conversation.updateOne(
        { conversationId: convId },
        {
          $setOnInsert: {
            sessionId: sessionId || convId,
            conversationId: convId,
            userId: userId || 'anonymous',
            domainId: domainId || null,
            domain: domainId || null,
            createdAt: new Date()
          },
          $push: { messages: { $each: messages } },
          $set: { updatedAt: new Date() }
        },
        { upsert: true }
      );
      return result;
    } catch (error) {
      console.error('Error saving conversation:', error);
      throw error;
    }
  }

  static async findBySessionId(sessionId) {
    if (!mongoConnected) return null;
    try {
      return await Conversation.findOne({ 
        $or: [
          { sessionId },
          { conversationId: sessionId }
        ]
      });
    } catch (error) {
      console.error('Error finding conversation:', error);
      throw error;
    }
  }

  static async listSessions(limit = 50, skip = 0) {
    if (!mongoConnected) return [];
    try {
      const conversations = await Conversation
        .find({})
        .select('sessionId conversationId userId domainId domain updatedAt messages')
        .sort({ updatedAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      return conversations.map(conv => ({
        sessionId: conv.sessionId || conv.conversationId,
        userId: conv.userId,
        domainId: conv.domainId || conv.domain,
        lastMsg: conv.messages && conv.messages.length > 0 
          ? (conv.messages[conv.messages.length - 1].text || conv.messages[conv.messages.length - 1].content || '').substring(0, 100) + '...'
          : 'No messages',
        messageCount: conv.messages ? conv.messages.length : 0,
        updatedAt: conv.updatedAt
      }));
    } catch (error) {
      console.error('Error listing sessions:', error);
      throw error;
    }
  }

  static async updateAssistantMessage(sessionId, question, newAnswer, editor) {
    if (!mongoConnected) throw new Error('MongoDB not connected');
    
    try {
      const conversation = await Conversation.findOne({ 
        $or: [
          { sessionId },
          { conversationId: sessionId }
        ]
      });
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      let targetIndex = -1;
      for (let i = 0; i < conversation.messages.length - 1; i++) {
        const msgText = conversation.messages[i].text || conversation.messages[i].content || '';
        if (conversation.messages[i].role === 'user' && 
            msgText === question &&
            conversation.messages[i + 1].role === 'assistant') {
          targetIndex = i + 1;
          break;
        }
      }

      if (targetIndex === -1) {
        throw new Error('Assistant message not found for the given question');
      }

      conversation.messages[targetIndex].text = newAnswer;
      conversation.messages[targetIndex].content = newAnswer;
      conversation.messages[targetIndex].edited = true;
      conversation.messages[targetIndex].editor = editor;
      conversation.updatedAt = new Date();

      await conversation.save();
      return { modifiedCount: 1 };
    } catch (error) {
      console.error('Error updating assistant message:', error);
      throw error;
    }
  }

  static async getSessionsByUserId(userId, limit = 20) {
    if (!mongoConnected) return [];
    try {
      return await Conversation
        .find({ userId })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      console.error('Error finding sessions by user:', error);
      throw error;
    }
  }

  static async getSessionsByDomain(domainId, limit = 100) {
    if (!mongoConnected) return [];
    try {
      return await Conversation
        .find({ 
          $or: [
            { domainId },
            { domain: domainId }
          ]
        })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      console.error('Error finding sessions by domain:', error);
      throw error;
    }
  }

  static async getStats() {
    if (!mongoConnected) {
      return {
        totalSessions: 0,
        totalMessages: 0,
        avgMessagesPerSession: 0,
        uniqueUsers: 0,
        uniqueDomains: 0,
        recentActivity: 0
      };
    }

    try {
      const stats = await Conversation.aggregate([
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            totalMessages: { $sum: { $size: '$messages' } },
            avgMessagesPerSession: { $avg: { $size: '$messages' } },
            uniqueUsers: { $addToSet: '$userId' },
            uniqueDomains: { $addToSet: { $ifNull: ['$domainId', '$domain'] } }
          }
        },
        {
          $project: {
            _id: 0,
            totalSessions: 1,
            totalMessages: 1,
            avgMessagesPerSession: { $round: ['$avgMessagesPerSession', 2] },
            uniqueUsers: { $size: '$uniqueUsers' },
            uniqueDomains: { $size: '$uniqueDomains' }
          }
        }
      ]);

      const result = stats.length > 0 ? stats[0] : {
        totalSessions: 0,
        totalMessages: 0,
        avgMessagesPerSession: 0,
        uniqueUsers: 0,
        uniqueDomains: 0
      };

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentActivity = await Conversation.countDocuments({
        updatedAt: { $gte: sevenDaysAgo }
      });

      result.recentActivity = recentActivity;
      return result;
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  }

  static async deleteSession(sessionId) {
    if (!mongoConnected) throw new Error('MongoDB not connected');
    try {
      const result = await Conversation.deleteOne({ 
        $or: [
          { sessionId },
          { conversationId: sessionId }
        ]
      });
      return result;
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }
}

module.exports = {
  initMongo,
  closeMongo,
  saveMessages,
  listConversations,
  getConversation,
  Conversation,
  Conversations,
  isConnected: () => mongoConnected
};