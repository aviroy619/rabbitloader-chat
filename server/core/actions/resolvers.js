'use strict';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function parseDateRange(text = '') {
  text = (text || '').toLowerCase();

  // explicit YYYY-MM-DD .. YYYY-MM-DD
  const m = text.match(/(\d{4}-\d{2}-\d{2}).*?(to|-|→|until|till).*?(\d{4}-\d{2}-\d{2})/i)
        || text.match(/(\d{4}-\d{2}-\d{2}).*?(\d{4}-\d{2}-\d{2})/);
  if (m) return { start_date: m[1], end_date: m[3] || m[2] };

  const end = new Date();
  const start = new Date(end);
  const fmt = (d) => d.toISOString().slice(0,10);

  if (/yesterday/.test(text)) { end.setDate(end.getDate()-1); start.setTime(end.getTime()); }
  else if (/last\s*7\s*days/.test(text) || /\bweek\b/.test(text)) { start.setDate(end.getDate()-7); }
  else if (/last\s*30\s*days/.test(text) || /\bmonth\b/.test(text)) { start.setDate(end.getDate()-30); }
  else if (/last\s*90\s*days/.test(text) || /\bquarter\b/.test(text)) { start.setDate(end.getDate()-90); }
  else { start.setDate(end.getDate()-30); } // default 30d

  return { start_date: fmt(start), end_date: fmt(end) };
}

function parseDomain(text='') {
  const m = text.match(/\b([a-z0-9][a-z0-9\-\.]+\.[a-z]{2,})\b/i);
  return m ? m[1].toLowerCase() : '';
}

async function resolveParams(actionMeta, userMsg, ctx) {
  const out = {};
  
  switch (actionMeta.id) {
    case 'report_overview_v1':
      const domain = ctx.domain || parseDomain(userMsg);
      const { start_date, end_date } = parseDateRange(userMsg);
      if (domain) out.domain = domain;
      if (ISO.test(start_date) && ISO.test(end_date)) { 
        out.start_date = start_date; 
        out.end_date = end_date; 
      }
      break;

    case 'canonical_urls_v1':
      const canonicalDomain = ctx.domain || parseDomain(userMsg);
      if (!canonicalDomain) {
        throw new Error('Domain required: specify in context or message (e.g., "canonical urls for example.com")');
      }
      out.domain = canonicalDomain;
      out.draw = 1;
      out.start = 0;
      out.length = 10;
      out['search[value]'] = '';
      out['order[0][column]'] = 1;
      out['order[0][dir]'] = 'desc';
      // DataTables column definitions
      out['columns[0][data]'] = 'url';
      out['columns[0][searchable]'] = 'true';
      out['columns[0][orderable]'] = 'false';
      out['columns[1][data]'] = 'create_time';
      out['columns[1][searchable]'] = 'true';
      out['columns[1][orderable]'] = 'true';
      out['columns[2][data]'] = 'update_time';
      out['columns[2][searchable]'] = 'true';
      out['columns[2][orderable]'] = 'true';
      break;

    case 'subscription_v2':
      // Prefer: ctx.get_params → env → hardcoded default
      out.get_params = ctx.get_params 
        || process.env.RL_SUBSCRIPTION_GET_PARAMS 
        || 'CgEBEAE%3D';
      const subM = userMsg.match(/get_params=([A-Za-z0-9_%\-]+)/);
      if (subM) out.get_params = subM[1];
      break;

    case 'profile_v2':
      out.get_params = '';
      break;

    case 'pageviews_v2':
      const dateRange = parseDateRange(userMsg);
      out.start_date = dateRange.start_date;
      out.end_date = dateRange.end_date;
      break;

    case 'domain_info_v2':
      // No additional params needed
      break;

    case 'plan_usage_v2':
      out.get_params = ctx.get_params 
        || process.env.RL_PLAN_USAGE_GET_PARAMS 
        || 'CAE%3D';
      break;

    case 'css_report_v1':
      out.domain = ctx.domain;
      break;

    case 'css_urls_v1':
      const cssUrlDomain = ctx.domain || parseDomain(userMsg);
      if (!cssUrlDomain) {
        throw new Error('Domain required: specify in context or message (e.g., "css urls for example.com")');
      }
      out.domain = cssUrlDomain;
      out.draw = 1;
      out.start = 0;
      out.length = 10;
      out['search[value]'] = '';
      out['order[0][column]'] = 1;
      out['order[0][dir]'] = 'asc';
      // DataTables column definitions
      out['columns[0][data]'] = 'url';
      out['columns[0][searchable]'] = 'true';
      out['columns[0][orderable]'] = 'false';
      out['columns[1][data]'] = 'refresh_required';
      out['columns[1][searchable]'] = 'true';
      out['columns[1][orderable]'] = 'true';
      out['columns[2][data]'] = 'css_size_all';
      out['columns[2][searchable]'] = 'true';
      out['columns[2][orderable]'] = 'false';
      out['columns[3][data]'] = 'css_size_p1';
      out['columns[3][searchable]'] = 'true';
      out['columns[3][orderable]'] = 'false';
      out['columns[4][data]'] = 'compression_p';
      out['columns[4][searchable]'] = 'true';
      out['columns[4][orderable]'] = 'false';
      break;

    case 'page_rules_v2':
      // No additional params needed
      break;

    case 'team_members_v2':
      // No additional params needed
      break;

    default:
      // Return empty object for unknown actions
      break;
  }

  return out;
}

module.exports = { resolveParams };