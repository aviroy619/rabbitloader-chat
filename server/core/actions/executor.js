'use strict';
const { actions } = require('./registry');
const { formatById } = require('./formatters');
const rl = require('../../clients/rabbitloader');
const { resolveParams } = require('./resolvers');

function interpolatePath(path, ctx) {
  let interpolated = path;
  
  // Replace {domainId} with ctx.domainId
  if (interpolated.includes('{domainId}')) {
    if (!ctx.domainId) {
      throw Object.assign(new Error('Missing path param: domainId'), { status: 400 });
    }
    interpolated = interpolated.replace(/{domainId}/g, ctx.domainId);
  }
  
  // Replace {domain} with ctx.domain (if we ever add such endpoints)
  if (interpolated.includes('{domain}')) {
    if (!ctx.domain) {
      throw Object.assign(new Error('Missing path param: domain'), { status: 400 });
    }
    interpolated = interpolated.replace(/{domain}/g, ctx.domain);
  }
  
  // Check if any placeholders remain
  const remainingPlaceholders = interpolated.match(/{[^}]+}/g);
  if (remainingPlaceholders) {
    const missing = remainingPlaceholders.join(', ');
    throw Object.assign(new Error(`Missing path params: ${missing}`), { status: 400 });
  }
  
  return interpolated;
}

async function executeAction(actionId, userMsg, ctx = {}) {
  const meta = actions[actionId];
  if (!meta) throw Object.assign(new Error(`Unknown actionId: ${actionId}`), { status: 400 });

  // Basic prechecks from registry.needs
  if (meta.needs?.includes('jwt') && !ctx.jwt) {
    throw Object.assign(new Error('Missing JWT'), { status: 401 });
  }
  if (meta.needs?.includes('domain') && !ctx.domain) {
    throw Object.assign(new Error('Missing domain'), { status: 400 });
  }
  if (meta.needs?.includes('domainId') && !ctx.domainId) {
    throw Object.assign(new Error('Missing domainId'), { status: 400 });
  }

  // Resolve params (support both flat and structured)
  const resolved = await resolveParams(meta, userMsg, ctx) || {};
  const method = (meta.endpoint.method || 'GET').toUpperCase();

  const hasStructured = typeof resolved === 'object' &&
                        (resolved.query || resolved.body || resolved.headers);

  const query = hasStructured
    ? (resolved.query || {})
    : (method === 'GET' ? resolved : {});

  const body = hasStructured
    ? (resolved.body || {})
    : (method !== 'GET' ? resolved : {});

  const extraHeaders = hasStructured ? (resolved.headers || {}) : {};

  // Interpolate path tokens
  const path = interpolatePath(meta.endpoint.path, ctx);

  try {
    // Call RL client
    const { data, http } = await rl.call({
      service: meta.endpoint.service || 'v1',
      method,
      path,
      ctx,
      query,
      body,
      headers: extraHeaders,
    });

    // Format and return
    const pretty = formatById(actionId, data) || 'Done.';
    return { pretty, raw: data, http };
    
  } catch (err) {
    const status = err.status || 500;
    if (status === 401 || status === 403) {
      const hint = status === 401 ? 'Session expired or invalid token.' : 'Not allowed for this account.';
      return {
        pretty: `Auth error: ${hint} Please sign in again in the Console and reopen chat.`,
        raw: { error: err.message },
        http: { status, url: (err.message.match(/\((GET|POST) .*?\)/)||[])[0] || '' }
      };
    }
    throw err;
  }
}

module.exports = { executeAction };