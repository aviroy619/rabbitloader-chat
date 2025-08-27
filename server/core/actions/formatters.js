'use strict';

function get(obj, path, fallback = undefined) {
  return path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj) ?? fallback;
}
function asInt(n, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}
function pct(n, d) {
  if (!d) return null;
  const v = Math.round((n / d) * 100);
  return Number.isFinite(v) ? v : null;
}
function fmtNum(n) {
  const v = asInt(n, null);
  return v === null ? '-' : v.toLocaleString();
}
function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 10) / 10 + ' ' + sizes[i];
}

function overview(payload) {
  if (!payload || payload.result === false) {
    const msg = (payload && payload.message) ? ` (${payload.message})` : '';
    return `Couldn't fetch overview${msg}.`;
  }

  const host       = get(payload, 'data.domain_details.host', '');
  const pv         = asInt(get(payload, 'data.bill.usage.pageviews_ctr', 0));
  const planPv     = asInt(get(payload, 'data.plan_limits.pageviews', 0));
  const usedPct    = pct(pv, planPv);

  const scoreAvg   = Number(get(payload, 'data.speed_score.avg_score', 0)); // 0..1
  const scorePct   = Math.round(scoreAvg * 100);

  const canTotal   = asInt(get(payload, 'data.speed_score.canonical_url_count', 0));
  const optTotal   = asInt(get(payload, 'data.speed_score.optimized_url_count', 0));

  const billStart  = String(get(payload, 'data.bill.start_date', '')).slice(0,10);
  const billEnd    = String(get(payload, 'data.bill.end_date', '')).slice(0,10);

  const planTitle  = get(payload, 'data.plan_details.title', '');
  const bandwidth  = asInt(get(payload, 'data.bill.usage.bandwidth_gb', 0));
  const bwLimit    = asInt(get(payload, 'data.plan_limits.bandwidth_gb', 0));
  const bwPct      = pct(bandwidth, bwLimit);

  const lines = [];
  if (host) lines.push(`Overview for ${host}`);
  if (billStart && billEnd) lines.push(`Period: ${billStart} → ${billEnd}`);

  // Usage
  const usageLine = `Pageviews: ${fmtNum(pv)}${planPv ? ` / ${fmtNum(planPv)}${usedPct !== null ? ` (${usedPct}%)` : ''}` : ''}`;
  lines.push(usageLine);

  // Speed score
  lines.push(`Speed score (avg): ${scorePct}/100`);

  // Canonical optimization
  if (canTotal || optTotal) lines.push(`Canonical URLs optimized: ${fmtNum(optTotal)} of ${fmtNum(canTotal)}`);

  // Bandwidth (if present)
  if (bwLimit) lines.push(`Bandwidth: ${fmtNum(bandwidth)} GB / ${fmtNum(bwLimit)} GB${bwPct !== null ? ` (${bwPct}%)` : ''}`);

  // Plan
  if (planTitle) lines.push(`Plan: ${planTitle}`);

  return lines.join('\n');
}

function canonicalUrls(payload) {
  if (!payload?.data?.records) {
    return 'No canonical URLs data available.';
  }

  const { records, recordsTotal } = payload.data;
  const lines = [`Canonical URLs Report (${fmtNum(recordsTotal)} total)`];
  
  const recent = records.slice(0, 5);
  recent.forEach(record => {
    const mobileScore = Math.round((record.score_m?.score || 0) * 100);
    const desktopScore = Math.round((record.score_d?.score || 0) * 100);
    const url = record.url.length > 60 ? record.url.substring(0, 57) + '...' : record.url;
    lines.push(`${url}`);
    lines.push(`  Mobile: ${mobileScore}/100, Desktop: ${desktopScore}/100`);
  });

  if (records.length > 5) {
    lines.push(`... and ${records.length - 5} more URLs`);
  }

  return lines.join('\n');
}

function subscription(payload) {
  console.log('[DEBUG] Subscription payload:', JSON.stringify(payload, null, 2));
  
  if (!payload?.subscriptions || !Array.isArray(payload.subscriptions)) {
    return 'No subscription data available.';
  }

  if (payload.subscriptions.length === 0) {
    return 'No subscriptions found.';
  }

  const lines = [`Subscription Details (${payload.subscriptions.length} domains)`];
  
  const subsToShow = payload.subscriptions.slice(0, 3);
  subsToShow.forEach((sub, i) => {
    const plan = sub.PricingPlan?.PricingPlanRL;
    const status = sub.status === 1 ? 'Active' : 'Inactive';
    const expiry = sub.expiryTime?.seconds ? new Date(sub.expiryTime.seconds * 1000).toISOString().slice(0, 10) : 'Unknown';
    
    lines.push(`Domain ${i + 1}: ${status}`);
    lines.push(`  Plan: ${plan?.planTitle || 'Unknown'}`);
    lines.push(`  Pageviews: ${fmtNum(plan?.limitPageViews || 0)}`);
    lines.push(`  Expires: ${expiry}`);
  });

  if (payload.subscriptions.length > 3) {
    lines.push(`... and ${payload.subscriptions.length - 3} more subscriptions`);
  }

  return lines.join('\n');
}

function profile(payload) {
  if (!payload) {
    return 'No profile data available.';
  }

  const lines = ['User Profile'];
  lines.push(`Name: ${payload.firstName || ''} ${payload.lastName || ''}`.trim());
  lines.push(`Email: ${payload.email || 'Not set'}`);
  
  if (payload.deviceLocation) {
    const loc = payload.deviceLocation;
    lines.push(`Location: ${loc.city || ''}, ${loc.region || ''} ${loc.countryCode || ''}`.replace(/,\s*,/g, ',').trim());
  }
  
  const brandCount = payload.brands?.length || 0;
  lines.push(`Brands: ${brandCount}`);

  return lines.join('\n');
}

function pageviews(payload) {
  if (!Array.isArray(payload) || payload.length === 0) {
    return 'No pageviews data available.';
  }

  const total = payload.reduce((sum, day) => sum + (day.pageview || 0), 0);
  const avgDaily = Math.round(total / payload.length);
  const recent = payload.slice(-7);
  const recentTotal = recent.reduce((sum, day) => sum + (day.pageview || 0), 0);

  const lines = [`Pageviews Report (${payload.length} days)`];
  lines.push(`Total: ${fmtNum(total)} pageviews`);
  lines.push(`Daily average: ${fmtNum(avgDaily)}`);
  lines.push(`Last 7 days: ${fmtNum(recentTotal)}`);

  // Show last few days
  lines.push('Recent activity:');
  recent.forEach(day => {
    const date = new Date(day.date).toISOString().slice(5, 10); // MM-DD
    lines.push(`  ${date}: ${fmtNum(day.pageview)}`);
  });

  return lines.join('\n');
}

function domainInfo(payload) {
  if (!payload) {
    return 'No domain information available.';
  }

  const lines = [`Domain Info: ${payload.host || 'Unknown'}`];
  
  // Performance scores
  if (payload.averageScore) {
    const avg = payload.averageScore;
    lines.push(`Average Scores:`);
    lines.push(`  Desktop: ${Math.round((avg.optimizedDesktop || 0) * 100)}/100 (was ${Math.round((avg.originalDesktop || 0) * 100)})`);
    lines.push(`  Mobile: ${Math.round((avg.optimizedMobile || 0) * 100)}/100 (was ${Math.round((avg.originalMobile || 0) * 100)})`);
  }

  // URLs and CSS
  lines.push(`Canonical URLs: ${fmtNum(payload.canonicalUrlCount || 0)}`);
  
  if (payload.css) {
    lines.push(`CSS: ${formatBytes(payload.css.cssSizeP1)} critical / ${formatBytes(payload.css.cssSizeAll)} total`);
  }

  return lines.join('\n');
}

function planUsage(payload) {
  if (!payload?.planUsage?.length) {
    return 'No plan usage data available.';
  }

  const usage = payload.planUsage[0];
  const limits = usage.limits || {};
  const used = usage.usage || {};

  const lines = [`Plan Usage: ${usage.planTitle || 'Unknown Plan'}`];
  
  // Pageviews
  const pvUsed = used.pageViews || 0;
  const pvLimit = limits.pageViews || 0;
  const pvPct = pct(pvUsed, pvLimit);
  lines.push(`Pageviews: ${fmtNum(pvUsed)} / ${fmtNum(pvLimit)}${pvPct !== null ? ` (${pvPct}%)` : ''}`);
  
  // Other limits
  lines.push(`Page Rules: 0 / ${fmtNum(limits.pageRules || 0)}`);
  lines.push(`Canonical URLs: 0 / ${fmtNum(limits.canonicalURLs || 0)}`);
  lines.push(`Images: 0 / ${fmtNum(limits.images || 0)}`);
  lines.push(`Delegates: 0 / ${fmtNum(limits.delegates || 0)}`);

  return lines.join('\n');
}

function cssReport(payload) {
  if (!payload?.data?.meta) {
    return 'No CSS report data available.';
  }

  const meta = payload.data.meta;
  const lines = ['CSS Optimization Report'];
  
  lines.push(`URLs processed: ${fmtNum(meta.canonical_url_count || 0)}`);
  lines.push(`Critical CSS: ${formatBytes(meta.css_size_p1 || 0)}`);
  lines.push(`Total CSS: ${formatBytes(meta.css_size_all || 0)}`);
  
  const reduction = meta.css_size_all - meta.css_size_p1;
  const reductionPct = pct(reduction, meta.css_size_all);
  lines.push(`Size reduction: ${formatBytes(reduction)}${reductionPct ? ` (${reductionPct}%)` : ''}`);

  return lines.join('\n');
}

function cssUrls(payload) {
  if (!payload?.data?.records) {
    return 'No CSS URLs data available.';
  }

  const { records, recordsTotal } = payload.data;
  const lines = [`CSS by URLs (${fmtNum(recordsTotal)} total)`];
  
  const recent = records.slice(0, 5);
  recent.forEach(record => {
    const url = record.url.length > 50 ? record.url.substring(0, 47) + '...' : record.url;
    const critical = formatBytes(record.css_size_p1 || 0);
    const total = formatBytes(record.css_size_all || 0);
    const refresh = record.refresh_required ? ' (needs refresh)' : '';
    
    lines.push(`${url}`);
    lines.push(`  Critical: ${critical}, Total: ${total}${refresh}`);
  });

  if (records.length > 5) {
    lines.push(`... and ${records.length - 5} more URLs`);
  }

  return lines.join('\n');
}

function pageRules(payload) {
  if (!payload?.pageRules?.length) {
    return 'No page rules configured.';
  }

  const lines = [`Page Rules (${payload.pageRules.length} active)`];
  
  payload.pageRules.forEach((rule, i) => {
    const pattern = rule.pathPattern || '*';
    const priority = rule.priority || 0;
    const opts = rule.optimizations || {};
    
    lines.push(`Rule ${i + 1}: ${pattern} (priority: ${priority})`);
    
    const features = [];
    if (opts.css?.defer) features.push('CSS defer');
    if (opts.js?.defer) features.push('JS defer');
    if (opts.image?.lazy) features.push('Image lazy');
    if (opts.webFont?.defer) features.push('Font defer');
    
    lines.push(`  Features: ${features.join(', ') || 'None'}`);
  });

  return lines.join('\n');
}

function teamMembers(payload) {
  if (!payload?.users?.length) {
    return 'No team members found.';
  }

  const lines = [`Team Members (${payload.users.length} total)`];
  
  payload.users.forEach(user => {
    const accessLevels = {
      1: 'View',
      2: 'Edit', 
      3: 'Admin',
      4: 'Owner'
    };
    const access = accessLevels[user.accessLevel] || `Level ${user.accessLevel}`;
    
    lines.push(`${user.name || 'Unnamed'} (${user.email})`);
    lines.push(`  Access: ${access}`);
  });

  return lines.join('\n');
}

const map = { 
  overview, 
  canonicalUrls, 
  subscription, 
  profile, 
  pageviews, 
  domainInfo, 
  planUsage, 
  cssReport, 
  cssUrls, 
  pageRules, 
  teamMembers 
};

function formatById(actionId, data) {
  const key = ({
    report_overview_v1: 'overview',
    canonical_urls_v1: 'canonicalUrls',
    subscription_v2: 'subscription',
    profile_v2: 'profile',
    pageviews_v2: 'pageviews',
    domain_info_v2: 'domainInfo',
    plan_usage_v2: 'planUsage',
    css_report_v1: 'cssReport',
    css_urls_v1: 'cssUrls',
    page_rules_v2: 'pageRules',
    team_members_v2: 'teamMembers'
  })[actionId];
  
  const fn = key && map[key];
  return fn ? fn(data) : 'Done.';
}

module.exports = { formatById };