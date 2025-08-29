// server/config.js
module.exports = {
  // Server
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // MongoDB
  mongoUrl: process.env.MONGO_URL || 'mongodb://localhost:27017/rabbitloader_chat',
  
  // Pinecone (using your existing env vars)
  pineconeApiKey: process.env.PINECONE_API_KEY,
  pineconeIndex: process.env.PINECONE_INDEX || 'rabbitloader-kb',
  
  // OpenAI (using your existing setup)
  openaiApiKey: process.env.OPENAI_API_KEY,
  
  // Authentication (if using JWT)
  jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-here',
  
  // Chat Configuration
  maxMessagesPerSession: parseInt(process.env.MAX_MESSAGES_PER_SESSION) || 100,
  sessionTimeoutHours: parseInt(process.env.SESSION_TIMEOUT_HOURS) || 24,
  
  // Vector Search Thresholds - FIXED: Lower thresholds for better matching
  adminEditThreshold: parseFloat(process.env.ADMIN_EDIT_THRESHOLD) || 0.35,
  priorityQaThreshold: parseFloat(process.env.PRIORITY_QA_THRESHOLD) || 0.15,  // Was 0.50
  kbThreshold: parseFloat(process.env.KB_THRESHOLD) || 0.15,  // Was 0.30
  
  // Rate Limiting (consistent with your existing setup)
  rateLimitRate: parseInt(process.env.RL_RATE) || 60,
  rateLimitBurst: parseInt(process.env.RL_BURST) || 60,
  
  // Admin Configuration
  adminUsers: process.env.ADMIN_USERS ? process.env.ADMIN_USERS.split(',') : ['admin@rabbitloader.com'],
  
  // Feature Flags
  features: {
    enableConversationStorage: process.env.ENABLE_CONVERSATION_STORAGE !== 'false',
    enableAdminEdits: process.env.ENABLE_ADMIN_EDITS !== 'false',
    enableUserProfiles: process.env.ENABLE_USER_PROFILES !== 'false'
  },

  // Logging (consistent with your existing middleware)
  logDir: process.env.LOG_DIR || './logs'
};