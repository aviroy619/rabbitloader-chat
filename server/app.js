'use strict';
require("dotenv").config({ path: ".env" });
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const express = require('express');
const morgan = require('morgan');

const cfg = require('./config');
const requestId = require('./middleware/request-id');
const errorHandler = require('./middleware/error');
const rateLimit = require('./middleware/ratelimit');

// Routes
const healthRoute = require('./routes/health');
const routeProbe  = require('./routes/route');
const cacheMw = require('./middleware/cache');
const chatRoute   = require('./routes/chat');
const adminRoute  = require('./routes/admin');
const { helmet, cors } = require('./middleware/security');
const readyRoute = require('./routes/ready');

// Helper: handle CommonJS or accidental ESM default exports
const asRouter = (mod) => (mod && mod.default) ? mod.default : mod;

// Helper: extract JWT from Authorization header
function extractJwt(req) {
  const h = req.headers?.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

const app = express();

// Core middleware
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));
app.use(requestId);
app.use(helmet());
app.use(cors());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/chat.html'));
});
// Rate limit (apply once, with env overrides)
const rateCfg = { 
  rate: Number(process.env.RL_RATE || 60), 
  burst: Number(process.env.RL_BURST || 60) 
};
app.use('/route', rateLimit(rateCfg));
app.use('/chat', rateLimit(rateCfg));

// Routes
app.use('/health', asRouter(healthRoute));
app.use('/route', asRouter(routeProbe));
app.use('/chat', cacheMw(30_000)); // 30s cache

// Enhanced chat route with JWT extraction
app.use('/chat', (req, res, next) => {
  if (req.method === 'POST') {
    const body = req.body || {};
    const bodyCtx = body.ctx || {};
    const headerJwt = extractJwt(req);
    
    // Merge JWT from header into context
    req.body.ctx = {
      ...bodyCtx,
      jwt: bodyCtx.jwt || headerJwt  // Allow body override but prefer header
    };
  }
  next();
});

app.use('/chat', asRouter(chatRoute));
app.use('/admin', asRouter(adminRoute));
app.use('/ready', readyRoute);
// Last-mile error handler (must be last)
app.use(errorHandler);

// Boot
app.listen(cfg.port, () => {
  console.log(
    `[server] listening on port ${cfg.port} (env=${cfg.nodeEnv})`
  );
});