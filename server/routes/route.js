'use strict';

const express = require('express');
const { routeMessage } = require('../core/router');

const router = express.Router();

router.post('/', (req, res) => {
  try {
    const { message } = req.body || {};
    const result = routeMessage(message);
    
    res.json({
      route: result.route,
      proposal: result.actionId ? { actionId: result.actionId } : null,
      trace: {
        decision: result.route,
        actionId: result.actionId || null
      }
    });
  } catch (err) {
    res.status(500).json({
      route: 'ERROR',
      error: err.message
    });
  }
});

module.exports = router;