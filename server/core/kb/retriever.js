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
      text: md.text || md.chunk || md.answer || ''  // include answer if present
    };
  });
}

async function retrieveKb(userMsg) {
  const v = await embed(userMsg);

  // Priority QA lookup
  const priorityResults = await queryPriorityQa(v, 3);
  const pq = normalizeMatches(priorityResults);
  console.log("DEBUG: Pinecone PQ results =>", JSON.stringify(pq, null, 2));

  if (pq.length && (pq[0].score || 0) > 0.50) {
    console.log("DEBUG: Passing PQ match with score", pq[0].score);
    return { priority: true, chunks: pq };
  } else {
    console.log("DEBUG: No PQ match passed threshold (0.50). Length =", pq.length);
  }

  // KB fallback
  const kbResults = await queryKb(v, 6);
  const kb = normalizeMatches(kbResults);
  console.log("DEBUG: Pinecone KB results =>", JSON.stringify(kb, null, 2));

  return { priority: false, chunks: kb };
}

module.exports = { retrieveKb };
