const { Pinecone } = require('@pinecone-database/pinecone');
const cfg = require('../config');

const pc = new Pinecone({ apiKey: cfg.pinecone.apiKey });
const kbIndex = () => pc.index(cfg.pinecone.indexKb);
const actionsIndex = () => pc.index(cfg.pinecone.indexActions);

async function queryKb(vector, topK = 6) {
  const res = await kbIndex().namespace(cfg.pinecone.nsKb).query({
    vector, topK, includeMetadata: true
  });
  return res.matches || [];
}

async function queryPriorityQa(vector, topK = 3) {
  const res = await kbIndex().namespace(cfg.pinecone.nsPriorityQa).query({
    vector, topK, includeMetadata: true
  });
  return res.matches || [];
}

async function queryActions(vector, topK = 3) {
  const res = await actionsIndex().namespace(cfg.pinecone.nsActions).query({
    vector, topK, includeMetadata: true
  });
  return res.matches || [];
}

module.exports = { queryKb, queryPriorityQa, queryActions };
