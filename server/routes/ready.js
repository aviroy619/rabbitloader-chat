'use strict';
const express = require('express');
const dns = require('dns').promises;
const cfg = require('../config');

const router = express.Router();
router.get('/', async (_req, res) => {
  const checks = {};
  try { await dns.lookup(new URL(cfg.rl.v1Base).hostname); checks.v1 = 'ok'; } catch(e){ checks.v1 = 'dns_fail'; }
  try { await dns.lookup(new URL(cfg.rl.v2Base).hostname); checks.v2 = 'ok'; } catch(e){ checks.v2 = 'dns_fail'; }
  // optionally ping Pinecone/OpenAI here if you want
  res.json({ ok: true, checks });
});
module.exports = router;
