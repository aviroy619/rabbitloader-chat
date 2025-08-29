const express = require("express");
const router = express.Router();

const routeMessage = require("../core/router");
const { executeAction } = require("../core/actions/executor");
const { retrieveKb } = require("../core/kb/retriever");
const { kbAnswer } = require("../core/kb/answer");

const logger = require("../core/logger");

router.post("/chat", async (req, res) => {
  const { sessionId, userMsg, ctx = {} } = req.body;
  const jwt = req.headers.authorization
    ? req.headers.authorization.replace("Bearer ", "")
    : "";

  // merge into ctx
  ctx.jwt = ctx.jwt || jwt;

  logger.debug("Header JWT:", jwt ? "present" : "missing");
  logger.debug("Base ctx:", ctx);

  try {
    // Decide route (ACTION vs QNA)
    const decision = await routeMessage(userMsg, ctx);
    logger.debug("Chat route decision for", userMsg, ":", decision);

    if (decision.route === "ACTION") {
      // ===== ACTION flow =====
      try {
        const result = await executeAction(decision.actionId, userMsg, ctx);
        return res.json({
          route: "ACTION",
          answer: result.answer,
          trace: {
            decision: "ACTION",
            actionId: decision.actionId,
            http: result.http,
          },
        });
      } catch (err) {
        logger.error("Action execution failed:", err);
        return res.status(400).json({
          ok: false,
          error: `Action failed (${decision.actionId}): ${err.message}`,
        });
      }
    } else {
      // ===== QNA flow =====
      const kbResults = await retrieveKb(userMsg);

      if (kbResults && kbResults.length > 0) {
        const topScore = kbResults[0].score;
        logger.debug(
          `Top KB score: ${topScore.toFixed(2)} for "${userMsg}"`
        );

        if (topScore >= 0.60) {
          // Use KB + OpenAI rewrite
          const answer = await kbAnswer(userMsg, kbResults);
          return res.json({
            route: "QNA",
            answer,
            trace: {
              decision: "QNA",
              sources: kbResults.slice(0, 3).map((r, i) => ({
                idx: i + 1,
                title: r.title || "KB",
                url: r.url || "",
                score: r.score,
              })),
            },
          });
        } else {
          // Too weak → fallback
          logger.debug(
            `KB score below threshold (0.60). Falling back to OpenAI.`
          );
        }
      }

      // Pure OpenAI fallback (no KB match)
      const answer = await kbAnswer(userMsg, []); // pass empty context
      return res.json({
        route: "QNA",
        answer,
        trace: { decision: "QNA", sources: [] },
      });
    }
  } catch (err) {
    logger.error("Chat route error:", err);
    return res
      .status(500)
      .json({ ok: false, error: err.message, requestId: req.requestId });
  }
});

module.exports = router;
