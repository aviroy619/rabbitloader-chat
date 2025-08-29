const { OpenAI } = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create embeddings (used in retriever.js and upload scripts)
async function embed(text) {
  if (!text || !text.trim()) {
    throw new Error("embed() called with empty text");
  }
  const resp = await client.embeddings.create({
    model: "text-embedding-3-small", // light + cheap, fine for KB
    input: text,
  });
  return resp.data[0].embedding;
}

// Chat completion (used for fallback answers if KB has no match)
async function chatCompletion(messages, opts = {}) {
  const resp = await client.chat.completions.create({
    model: opts.model || "gpt-4o-mini",
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.max_tokens ?? 300,
  });
  return resp.choices[0].message.content;
}

module.exports = {
  embed,
  chatCompletion,
  client, // export raw client in case you need fine-grained calls
};