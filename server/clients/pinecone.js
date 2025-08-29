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

// New: Query admin edits namespace (highest priority)
async function queryAdminEdits(vector, topK = 3) {
  try {
    const results = await index.namespace("admin-edits").query({
      vector,
      topK,
      includeMetadata: true,
    });
    return results.matches;
  } catch (error) {
    console.log("Admin edits namespace may not exist yet:", error.message);
    return [];
  }
}

// New: Query any specific namespace
async function queryNamespace(namespace, vector, topK = 3) {
  try {
    const results = await index.namespace(namespace).query({
      vector,
      topK,
      includeMetadata: true,
    });
    return results.matches;
  } catch (error) {
    console.error(`Error querying ${namespace} namespace:`, error);
    return [];
  }
}

// New: Upsert vectors to a specific namespace
async function upsertToNamespace(namespace, vectors) {
  try {
    const results = await index.namespace(namespace).upsert(vectors);
    console.log(`Successfully upserted ${vectors.length} vectors to ${namespace} namespace`);
    return results;
  } catch (error) {
    console.error(`Error upserting to ${namespace} namespace:`, error);
    throw error;
  }
}

// New: Delete vectors from a namespace
async function deleteFromNamespace(namespace, ids) {
  try {
    const results = await index.namespace(namespace).deleteMany(ids);
    console.log(`Successfully deleted ${ids.length} vectors from ${namespace} namespace`);
    return results;
  } catch (error) {
    console.error(`Error deleting from ${namespace} namespace:`, error);
    throw error;
  }
}

// New: Get namespace statistics
async function getNamespaceStats() {
  try {
    const stats = await index.describeIndexStats();
    return stats;
  } catch (error) {
    console.error('Error getting namespace stats:', error);
    throw error;
  }
}

module.exports = {
  queryPriorityQa,
  queryActions,
  queryKb,
  queryAdminEdits,
  queryNamespace,
  upsertToNamespace,
  deleteFromNamespace,
  getNamespaceStats
};