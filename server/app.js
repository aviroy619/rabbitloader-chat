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

// MongoDB initialization
const { initMongo } = require('./storage/mongo');

// Routes
const healthRoute = require('./routes/health');
const routeProbe  = require('./routes/route');
const cacheMw = require('./middleware/cache');
const adminRoute  = require('./routes/admin');
const { helmet, cors } = require('./middleware/security');
const readyRoute = require('./routes/ready');
const chatRoute = require('./routes/chat');
// Helper: handle CommonJS or accidental ESM default exports
const asRouter = (mod) => (mod && mod.default) ? mod.default : mod;

// Helper: extract JWT from Authorization header
function extractJwt(req) {
  const h = req.headers?.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

// Helper: extract user context from JWT or headers
function extractUserContext(req) {
  const jwt = extractJwt(req);
  let userId = 'anonymous';
  let domainId = null;

  // Try to extract from JWT (you can customize this based on your JWT structure)
  if (jwt) {
    try {
      // If you have JWT verification, uncomment and modify:
      // const decoded = require('jsonwebtoken').verify(jwt, process.env.JWT_SECRET);
      // userId = decoded.uid || decoded.userId || decoded.sub || 'anonymous';
      // domainId = decoded.domainId || decoded.domain;
      
      // For now, extract from headers as fallback
      userId = req.headers['x-user-id'] || 'anonymous';
      domainId = req.headers['x-domain-id'] || null;
    } catch (error) {
      console.warn('JWT parsing failed:', error.message);
      userId = req.headers['x-user-id'] || 'anonymous';
      domainId = req.headers['x-domain-id'] || null;
    }
  } else {
    // No JWT, try headers
    userId = req.headers['x-user-id'] || 'anonymous';
    domainId = req.headers['x-domain-id'] || null;
  }

  return { userId, domainId, jwt };
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

// Serve admin UI
app.use('/admin-ui', express.static(path.join(__dirname, '../frontend/admin')));
app.get('/admin-ui', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin/index.html'));
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
app.use('/chat', chatRoute);

// Enhanced chat route with JWT extraction and user context
app.use('/chat', cacheMw(30_000)); // 30s cache
app.use('/chat', (req, res, next) => {
  if (req.method === 'POST') {
    const body = req.body || {};
    const bodyCtx = body.ctx || {};
    const userContext = extractUserContext(req);
    
    // Merge context: body can override, but we ensure consistent userId/domainId
    req.body.ctx = {
      ...bodyCtx,
      jwt: bodyCtx.jwt || userContext.jwt,
      userId: bodyCtx.userId || userContext.userId,
      domainId: bodyCtx.domainId || userContext.domainId
    };

    // Also add to req for easy access
    req.userContext = userContext;
  }
  next();
});
app.use('/chat', asRouter(chatRoute));

// Admin route - SINGLE MOUNTING ONLY
app.use('/admin', (req, res, next) => {
  // Add basic admin auth here if needed
  // For now, allow all requests - you can add JWT admin role checking
  next();
});
app.use('/admin', asRouter(adminRoute));

// Other routes
app.use('/ready', readyRoute);

// API documentation
app.get('/api-docs', (req, res) => {
  res.json({
    endpoints: {
      'POST /chat': 'Send a chat message',
      'GET /chat/session/:sessionId': 'Get conversation history',
      'GET /chat/sessions': 'Get user sessions',
      'GET /admin/sessions': 'List all sessions (admin)',
      'GET /admin/session/:sessionId': 'Get session details (admin)',
      'POST /admin/edit': 'Edit assistant answer (admin)',
      'GET /admin/stats': 'Get conversation statistics (admin)',
      'DELETE /admin/session/:sessionId': 'Delete session (admin)',
      'GET /admin/logs': 'Get system logs (admin)'
    },
    version: '1.0.0',
    documentation: 'Visit /admin-ui for the admin interface'
  });
});

// Last-mile error handler (must be last)
app.use(errorHandler);

// Initialize MongoDB and start server
async function startServer() {
  try {
    console.log('Initializing MongoDB...');
    await initMongo();
    console.log('MongoDB initialized successfully');

    const port = cfg.port || process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`[server] listening on port ${port} (env=${cfg.nodeEnv || process.env.NODE_ENV})`);
      console.log(`📊 Admin UI available at http://localhost:${port}/admin-ui`);
      console.log(`📖 API docs at http://localhost:${port}/api-docs`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  const { closeMongo } = require('./storage/mongo');
  await closeMongo();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  const { closeMongo } = require('./storage/mongo');
  await closeMongo();
  process.exit(0);
});

// Start the server
if (require.main === module) {
  startServer();
}