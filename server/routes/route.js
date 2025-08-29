const express = require('express');
const { ulid } = require('ulid');
const { retrieveKb } = require('../core/kb/retriever');

const router = express.Router();

// --- ROUTE HANDLER START ---
router.post('/', async (req, res) => {
  const { sessionId, userMsg } = req.body;

  const trace = {
    decision: null,
    actionId: null,
    requestId: req.headers['x-request-id'] || ulid()
  };

  try {
    if (!userMsg || typeof userMsg !== 'string') {
      return res.status(400).json({
        route: "error",
        error: "userMsg must be a non-empty string",
        trace
      });
    }

    // Call retriever (which now may return { source: 'fallback' })
    const kbResult = await retrieveKb(userMsg.trim(), trace);

    if (kbResult.source === "fallback") {
      trace.decision = "fallback";
      return res.json({
        route: "QNA",
        proposal: null,
        trace
      });
    }

    // If retriever found a KB/Admin/PQ match
    if (kbResult.chunks && kbResult.chunks.length > 0) {
      trace.decision = "QNA";
      return res.json({
        route: "QNA",
        proposal: {
          text: kbResult.chunks[0].text,
          confidence: kbResult.chunks[0].score || 0
        },
        trace
      });
    }

    // If no matches → fallback
    trace.decision = "fallback";
    return res.json({
      route: "QNA",
      proposal: null,
      trace
    });

  } catch (err) {
    console.error("Route decision error:", err);
    trace.decision = "error";
    res.status(500).json({
      route: "error",
      error: err.message,
      trace
    });
  }
});
// --- ROUTE HANDLER END ---

module.exports = router;
