const express = require('express');
const cfg = require('../config');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ ok: true, port: cfg.port, uptimeSec: Math.round(process.uptime()) });
});

module.exports = router; // <-- IMPORTANT: export the router function
