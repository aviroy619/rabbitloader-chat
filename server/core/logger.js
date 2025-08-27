const fs = require('fs');
const path = require('path');
const cfg = require('../config');

function ensureDir() {
  fs.mkdirSync(cfg.logDir, { recursive: true });
}
function maskJwt(jwt) {
  if (!jwt) return '';
  return jwt.length <= 12 ? '***' : `${jwt.slice(0,6)}...${jwt.slice(-6)}`;
}
function log(type, payload) {
  ensureDir();
  const file = path.join(cfg.logDir, `${new Date().toISOString().slice(0,10)}.jsonl`);
  const safe = { ts: new Date().toISOString(), type, ...payload };
  if (safe.ctx?.jwt) safe.ctx.jwt = maskJwt(safe.ctx.jwt);
  fs.appendFileSync(file, JSON.stringify(safe) + '\n');
}
module.exports = { log };
