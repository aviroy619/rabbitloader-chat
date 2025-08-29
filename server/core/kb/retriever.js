const { embed } = require('../../clients/openai');
const { 
  queryPriorityQa, 
  queryKb, 
  queryAdminEdits, 
  upsertToNamespace 
} = require('../../clients/pinecone');
const cfg = require('../../config');

function normalizeMatches(matches) {
  return (matches || []).map(m => {
    const md = m.metadata || {};
    return {
      id: m.id,
      score: m.score,
      title: md.title || md.source || 'KB',
      url: md.url || md.link || '',
      text: md.text || md.chunk || md.answer || '',
      source: md.source || 'kb',
      editor: md.editor || null,
      sessionId: md.sessionId || null
    };
  });
}

// --- Function to edit in server/core/kb/retriever.js ---
async function retrieveKb(userMsg, trace) {
  try {
    // 1. Check Admin Edits first
    const adminResults = await pinecone.query("rabbitloader-kb", "admin-edits", await openai.embed(userMsg), 3);
    console.log("DEBUG: Pinecone Admin Edits results =>", adminResults);

    if (adminResults.length > 0 && adminResults[0].score >= 0.35) {
      console.log(`DEBUG: Admin Edit match found with score ${adminResults[0].score}`);
      return {
        source: "admin-edits",
        confidence: adminResults[0].score,
        chunks: adminResults
      };
    }

    // 2. Priority QA
    const pqResults = await pinecone.query("rabbitloader-kb", "priority-qa", await openai.embed(userMsg), 3);
    console.log("DEBUG: Pinecone PQ results =>", pqResults);

    if (pqResults.length > 0 && pqResults[0].score >= 0.50) {
      console.log(`DEBUG: Priority QA match found with score ${pqResults[0].score}`);
      return {
        source: "priority-qa",
        confidence: pqResults[0].score,
        chunks: pqResults
      };
    }

    // 3. General KB
    const kbResults = await pinecone.query("rabbitloader-kb", "kb", await openai.embed(userMsg), 3);
    console.log("DEBUG: Pinecone KB results =>", kbResults);

    if (kbResults.length > 0 && kbResults[0].score >= 0.60) {
      console.log(`DEBUG: KB match found with score ${kbResults[0].score}`);
      return {
        source: "kb",
        confidence: kbResults[0].score,
        chunks: kbResults
      };
    }

    // 4. If nothing passes thresholds → fallback
    console.log("DEBUG: No KB matches passed thresholds, using fallback.");
    return {
      source: "fallback",
      confidence: 0,
      chunks: []
    };

  } catch (err) {
    console.error("Retriever error:", err);
    return {
      source: "error",
      confidence: 0,
      chunks: []
    };
  }
}


// Helper function to store admin edits in Pinecone
async function storeAdminEdit(question, answer, editor, sessionId) {
  try {
    const questionEmbedding = await embed(question);
    const editId = `admin_edit_${sessionId}_${Date.now()}`;
    
    const vectors = [{
      id: editId,
      values: questionEmbedding,
      metadata: {
        text: answer,
        answer: answer,
        source: 'admin',
        editor: editor,
        sessionId: sessionId,
        question: question,
        createdAt: new Date().toISOString()
      }
    }];

    await upsertToNamespace('admin-edits', vectors);
    console.log("DEBUG: Admin edit stored in Pinecone:", editId);
    return editId;
  } catch (error) {
    console.error("Error storing admin edit in Pinecone:", error);
    throw error;
  }
}

module.exports = { 
  retrieveKb, 
  storeAdminEdit, 
  normalizeMatches 
};