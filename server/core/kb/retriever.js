const { embed } = require('../../clients/openai');
const { queryPriorityQa, queryKb } = require('../../clients/pinecone');

function normalizeMatches(matches) {
  return (matches || []).map(m => {
    const md = m.metadata || {};
    return {
      id: m.id,
      score: m.score,
      title: md.title || md.source || 'KB',
      url: md.url || md.link || '',
      text: md.text || md.chunk || ''
    };
  });
}

async function retrieveKb(userMsg) {
  const v = await embed(userMsg);
  // try priority QA first
  const pq = normalizeMatches(await queryPriorityQa(v, 3));
  if (pq.length && (pq[0].score || 0) > 0.82) {
    return { priority: true, chunks: pq };
  }
  const kb = normalizeMatches(await queryKb(v, 6));
  return { priority: false, chunks: kb };
}

module.exports = { retrieveKb };
