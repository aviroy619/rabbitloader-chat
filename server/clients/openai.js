const OpenAI = require('openai');
const cfg = require('../config');

const client = new OpenAI({ apiKey: cfg.openai.apiKey });

async function embed(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid text input for embedding');
  }
  const res = await client.embeddings.create({
    model: cfg.openai.embedModel,
    input: text.slice(0, 8000)
  });
  return res.data[0].embedding;
}

async function chat({ system, user, maxTokens = 300 }) {
  if (!user || typeof user !== 'string') {
    throw new Error('Invalid user message for chat');
  }
  const res = await client.chat.completions.create({
    model: cfg.openai.chatModel,
    max_tokens: maxTokens,
    temperature: 0.2,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: user }
    ]
  });
  return res.choices[0].message.content.trim();
}

module.exports = { embed, chat };