'use strict';

const axios = require('axios');
const https = require('https');
const { Resolver } = require('dns').promises;
const cfg = require('../config');

// ---------- helpers ----------
function pickBase(service) {
  if (service === 'v2') return (cfg.rl.v2Base || '').replace(/\/$/, '');
  if (service === 'v1') return (cfg.rl.v1Base || '').replace(/\/$/, '');
  return (cfg.rl.baseUrl || cfg.rl.v1Base || '').replace(/\/$/, ''); // legacy fallback
}
function makeUrl(base, path) {
  const b = (base || '').replace(/\/$/, '');
  const p = (path || '').startsWith('/') ? path : `/${path || ''}`;
  return b + p;
}
async function resolveA(host) {
  try {
    const r = new Resolver();
    r.setServers(['1.1.1.1', '8.8.8.8']); // public resolvers to dodge corp DNS quirks
    const ips = await r.resolve4(host);
    return Array.isArray(ips) && ips[0] ? ips[0] : null;
  } catch {
    return null;
  }
}
function qsFrom(obj) {
  if (!obj || typeof obj !== 'object' || !Object.keys(obj).length) return '';
  return '?' + new URLSearchParams(obj).toString();
}
async function axiosCall(opt) {
  const t0 = Date.now();
  const resp = await axios(opt);
  const qs = opt.params ? qsFrom(opt.params) : '';
  return {
    data: resp.data,
    http: {
      status: resp.status,
      latencyMs: Date.now() - t0,
      url: opt.url + qs
    }
  };
}

// ---------- main ----------
/**
 * call({ service:'v1'|'v2', method, path, ctx, query, body, headers })
 * ctx.jwt -> Authorization: Bearer
 * ctx.domainId -> x-domain-id (harmless if endpoint ignores it)
 */
async function call({ service = 'v1', method = 'GET', path = '', ctx = {}, query = {}, body = {}, headers = {} }) {
  const base = pickBase(service);
  const url = makeUrl(base, path);
  const host = new URL(url).hostname;

  const h = {
    Accept: 'application/json',
    ...headers
  };
  if (ctx.jwt) h['Authorization'] = `Bearer ${ctx.jwt}`;
  if (ctx.domainId) h['x-domain-id'] = ctx.domainId;
  if (process.env.RL_CLIENT_ORIGIN) h['Origin'] = process.env.RL_CLIENT_ORIGIN;

  const opt = {
    method,
    url,
    headers: h,
    timeout: 15000
  };
  if (String(method).toUpperCase() === 'GET') opt.params = query;
  else opt.data = body;

  if (cfg.flowDebug) {
    const dbg = { method, url, query: opt.params, hasJwt: !!ctx.jwt, hasDomainId: !!ctx.domainId, service };
    console.log('[RL CALL]', JSON.stringify(dbg));
  }

  try {
    return await axiosCall(opt);
  } catch (err) {
    const code = err.code || '';
    const msgStr = err.response?.data || err.message || String(err);
if ((process.env.DNS_FALLBACK || '1') !== '0' && (code === 'ENOTFOUND' || /ENOTFOUND/i.test(String(msgStr)))) {
    // DNS fallback: if host can’t resolve, resolve via public DNS and call by IP with SNI + Host header
    if (code === 'ENOTFOUND' || /ENOTFOUND/i.test(String(msgStr))) {
      const ip = await resolveA(host);
      if (ip) {
        const ipUrl = url.replace(host, ip);
        const agent = new https.Agent({ servername: host }); // keep TLS SNI for correct cert
        const opt2 = {
          ...opt,
          url: ipUrl,
          httpsAgent: agent,
          headers: { ...h, Host: host } // preserve Host for CDN routing
        };
        if (cfg.flowDebug) console.log('[RL DNS-FALLBACK] ->', ipUrl);
        try {
          return await axiosCall(opt2);
        } catch (err2) {
          const s2 = err2.response?.status || 0;
          const m2 = err2.response?.data || err2.message || String(err2);
          const e2 = new Error(`RL API failed after DNS fallback (${method} ${url}) [${s2 || err2.code || 'ERR'}]: ${typeof m2 === 'string' ? m2 : JSON.stringify(m2)}`);
          e2.status = s2 || 502;
          throw e2;
        }
      }
    }
}

    const status = err.response?.status || 0;
    const e = new Error(`RL API failed (${method} ${url}) [${status || code || 'ERR'}]: ${typeof msgStr === 'string' ? msgStr : JSON.stringify(msgStr)}`);
    e.status = status || 502;
    throw e;
  }
}

module.exports = { call };
