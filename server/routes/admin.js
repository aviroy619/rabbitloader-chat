'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const cfg = require('../config');

const router = express.Router();

// GET /admin/logs?limit=50
router.get('/logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '200', 10), 1000);
  const today = new Date().toISOString().slice(0,10);
  const file = path.join(cfg.logDir, `${today}.jsonl`);

  if (!fs.existsSync(file)) {
    return res.json({ ok: true, items: [], note: `no log file at ${file}` });
  }

  const lines = fs.readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .slice(-limit);

  const items = lines.map((l) => {
    try { return JSON.parse(l); } catch { return { raw: l }; }
  });

  res.json({ ok: true, items });
});

module.exports = router;
