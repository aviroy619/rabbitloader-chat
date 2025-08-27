'use strict';

function extractCtx(req) {
  // JWT only from header (or ctx.jwt); never from user text
  const headerJwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const bodyCtx = req.body?.ctx || {};
  const jwt = headerJwt || bodyCtx.jwt || '';
  const domainId = bodyCtx.domainId || '';
  const domain = (bodyCtx.domain || '').toString().trim().toLowerCase(); // <-- add & normalize
  return { jwt, domainId, domain };
}

function missingParams(needs, ctx) {
  const miss = [];
  if (needs.includes('jwt') && !ctx.jwt) miss.push('jwt');
  if (needs.includes('domainId') && !ctx.domainId) miss.push('domainId');
  return miss;
}

module.exports = { extractCtx, missingParams };
