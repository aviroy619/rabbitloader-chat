'use strict';
const express = require('express');
const { routeMessage } = require('../core/router');
const { extractCtx, missingParams } = require('../core/params');
const { actions } = require('../core/actions/registry');
const { executeAction } = require('../core/actions/executor');
const { retrieveKb } = require('../core/kb/retriever');
const { kbAnswer } = require('../core/kb/answer');
const { chat } = require('../clients/openai');
const { log } = require('../core/logger');

const router = express.Router();

// Helper: extract JWT from Authorization header
function extractJwt(req) {
  const h = req.headers?.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

router.post('/', async (req, res, next) => {
  const t0 = Date.now();
  try {
    const { userMsg } = req.body || {};
    const baseCtx = extractCtx(req);
    
    // Extract JWT from Authorization header and merge with context
    const headerJwt = extractJwt(req);
    console.log('[DEBUG] Header JWT:', headerJwt ? 'present' : 'missing');
    console.log('[DEBUG] Base ctx:', baseCtx);
    
    const ctx = {
      ...baseCtx,
      jwt: baseCtx.jwt || headerJwt  // Prefer body context, fallback to header
    };
    console.log('[DEBUG] Final ctx JWT status:', ctx.jwt ? 'present' : 'missing');
    
    const r = routeMessage(userMsg);
    console.log('[DEBUG] Chat route decision for', userMsg, ':', r);

    if (r.route === 'ACTION') {
      const meta = actions[r.actionId];
      if (!meta) {
        console.log('[DEBUG] Action not found in registry:', r.actionId);
        return res.status(400).json({
          route: 'ERROR',
          error: `Action ${r.actionId} not found in registry`
        });
      }
      
      const need = missingParams(meta.needs, ctx);
      if (need.length) {
        log('chat-missing', { id: req.id, need, ctx: { jwt: ctx.jwt ? 'present' : '', domainId: ctx.domainId || '' } });
        return res.status(400).json({
          route: 'ACTION',
          error: 'Missing required context',
          need,
          trace: { decision: 'ACTION', actionId: r.actionId }
        });
      }

      const exec = await executeAction(r.actionId, userMsg, ctx);
      log('chat-action', { id: req.id, actionId: r.actionId, http: exec.http });

      return res.json({
        route: 'ACTION',
        answer: exec.pretty,
        trace: {
          decision: 'ACTION',
          actionId: r.actionId,
          http: { status: exec.http.status, ms: exec.http.latencyMs }
        }
      });
    }

    // QNA path
    const retrieved = await retrieveKb(userMsg);

    if (!retrieved.chunks || retrieved.chunks.length === 0) {
      // Fallback: direct OpenAI chat (for greetings/smalltalk)
      const fallbackAnswer = await chat({
        system: "You are RabbitLoader Support. Be friendly but concise. Answer greetings or general queries naturally, but always keep it short.",
        user: userMsg,
        maxTokens: 200
      });

      log('chat-openai-fallback', { id: req.id });

      return res.json({
        route: 'QNA',
        answer: fallbackAnswer,
        trace: { decision: 'QNA', sources: [] }
      });
    }

    const qa = await kbAnswer(userMsg, retrieved);
    log('chat-kb', { id: req.id, kbSources: retrieved.chunks?.length || 0 });

    return res.json({
      route: 'QNA',
      answer: qa.answer,
      trace: {
        decision: 'QNA',
        sources: (qa.sources || []).slice(0, 3) // compact: at most 3 sources
      }
    });
  } catch (e) { next(e); }
});

module.exports = router;