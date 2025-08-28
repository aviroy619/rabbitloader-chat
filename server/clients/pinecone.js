// server/clients/pinecone.js
const { Pinecone } = require("@pinecone-database/pinecone");

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index(process.env.PINECONE_INDEX || "rabbitloader-kb");

async function queryPriorityQa(vector, topK = 3) {
  const results = await index.namespace("priority-qa").query({
    vector,
    topK,
    includeMetadata: true,
  });
  return results.matches;
}

async function queryActions(vector, topK = 3) {
  const results = await index.namespace("actions").query({
    vector,
    topK,
    includeMetadata: true,
  });
  return results.matches;
}

async function queryKb(vector, topK = 3) {
  const results = await index.namespace("kb").query({
    vector,
    topK,
    includeMetadata: true,
  });
  return results.matches;
}

module.exports = {
  queryPriorityQa,
  queryActions,
  queryKb,
};
