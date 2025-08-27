'use strict';
const LRU = new Map(); // naive in-memory; swap for a real LRU if you want

function keyOf(req) {
  if (req.method !== 'POST' || req.path !== '/chat') return null;
  // Cache only ACTION+GET calls; the executor uses GET for v1 overview etc.
  const body = req.body || {};
  const userMsg = (body.userMsg || '').trim().toLowerCase();
  // crude cache key: action hint + userMsg + domain
  const domain = body.ctx?.domain || '';
  return `chat:${domain}:${userMsg}`;
}

module.exports = function cacheMw(ttlMs = 30000) {
  return (req, res, next) => {
    const k = keyOf(req);
    if (!k) return next();

    const now = Date.now();
    const item = LRU.get(k);
    if (item && (now - item.ts) < ttlMs) {
      return res.json(item.payload);
    }

    const json = res.json.bind(res);
    res.json = (payload) => {
      // cache success ACTION responses only
      if (payload && payload.route === 'ACTION' && payload.trace?.action?.http?.status === 200) {
        LRU.set(k, { ts: Date.now(), payload });
      }
      return json(payload);
    };
    next();
  };
};
