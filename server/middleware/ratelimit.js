'use strict';
// Simple token bucket per IP and per domainId (if present)
const BUCKETS = new Map();
const now = () => Date.now();

function bucket(key, rate = 60, burst = 60) {
  const b = BUCKETS.get(key) || { tokens: burst, ts: now() };
  const t = now();
  const refill = ((t - b.ts) / 1000) * (rate / 60); // rate per minute
  b.tokens = Math.min(burst, b.tokens + refill);
  b.ts = t;
  if (b.tokens < 1) return { ok: false, retryMs: Math.ceil((1 - b.tokens) * (60000 / rate)) };
  b.tokens -= 1;
  BUCKETS.set(key, b);
  return { ok: true };
}

module.exports = (opts = {}) => (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress || 'ip:unknown';
  const did = req.body?.ctx?.domainId ? `did:${req.body.ctx.domainId}` : '';
  const k1 = `ip:${ip}`;
  const k2 = did ? `${k1}+${did}` : k1;
  const { ok, retryMs } = bucket(k2, opts.rate || 60, opts.burst || 60);
  if (!ok) {
    return res.status(429).json({ ok: false, error: 'rate_limited', retryMs });
  }
  next();
};
