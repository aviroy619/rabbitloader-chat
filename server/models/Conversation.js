const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  role: String, // "user" | "assistant"
  text: String,
  timestamp: { type: Date, default: Date.now }
});

const ConversationSchema = new mongoose.Schema({
  conversationId: { type: String, unique: true },
  userId: String,
  domainId: String,
  messages: [MessageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Conversation", ConversationSchema);
