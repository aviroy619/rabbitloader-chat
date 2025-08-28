const { chatCompletion } = require('../../clients/openai');

function buildPrompt(userMsg, chunks) {
  const ctx = chunks.slice(0, 4).map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n');
  const cites = chunks
    .slice(0, 4)
    .map((c, i) => `(${i + 1}) ${c.title}${c.url ? ' - ' + c.url : ''}`)
    .join('\n');

  const system = `You are RabbitLoader Support. Answer tersely (3-6 sentences).
If the user asks to delete/disable/remove anything, DO NOT provide steps—tell them to use the Console manually.
Prefer RabbitLoader KB context if available; otherwise, answer based on your general knowledge.`;

  const user = `Question: ${userMsg}

Context:
${ctx || "No context was retrieved from KB."}

When you answer, keep it short and, if possible, include a bulleted mini-checklist.
At the end, if sources are available, list them as [1].. lines.
Sources:
${cites || "None"}`;

  return { system, user };
}

async function kbAnswer(userMsg, retrieved) {
  const chunks = retrieved.chunks || [];

  const { system, user } = buildPrompt(userMsg, chunks);

  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  const answer = await chatCompletion(messages, {
    model: "gpt-4o-mini",
    max_tokens: 350,
  });

  const sources = chunks.slice(0, 4).map((c, i) => ({
    idx: i + 1,
    title: c.title,
    url: c.url,
  }));

  return { answer, sources };
}

module.exports = { kbAnswer };
