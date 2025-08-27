const { chat } = require('../../clients/openai');

function buildPrompt(userMsg, chunks) {
  const ctx = chunks.slice(0, 4).map((c,i) => `[${i+1}] ${c.text}`).join('\n\n');
  const cites = chunks.slice(0, 4).map((c,i) => `(${i+1}) ${c.title}${c.url ? ' - ' + c.url : ''}`).join('\n');
  const system = `You are RabbitLoader Support. Answer tersely (3-6 sentences). 
If the user asks to delete/disable/remove anything, DO NOT provide steps—tell them to use the Console manually.
Only use the provided context; if unsure, say so.`;
  const user = `Question: ${userMsg}

Context:
${ctx}

When you answer, keep it short and, if possible, include a bulleted mini-checklist. 
At the end, list the sources as [1].. lines.
Sources:
${cites}`;
  return { system, user };
}

async function kbAnswer(userMsg, retrieved) {
  const chunks = retrieved.chunks || [];
  if (!chunks.length) {
    const answer = `I don’t have enough context to answer that. Open the RabbitLoader Console and check the relevant section.`;
    return { answer, sources: [] };
  }
  const { system, user } = buildPrompt(userMsg, chunks);
  const answer = await chat({ system, user, maxTokens: 350 });
  const sources = chunks.slice(0,4).map((c,i) => ({ idx: i+1, title: c.title, url: c.url }));
  return { answer, sources };
}

module.exports = { kbAnswer };
