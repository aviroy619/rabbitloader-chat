'use strict';
const cors = require('cors');
const helmet = require('helmet');

module.exports = {
  helmet() {
    return helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    });
  },
  cors() {
    const allow = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
    return cors({
      origin: allow.length ? allow : true, // default allow all in dev, lock via env in prod
      credentials: true,
      allowedHeaders: ['Content-Type','Authorization','x-domain-id','Accept','Origin'],
      methods: ['GET','POST','OPTIONS']
    });
  }
};
