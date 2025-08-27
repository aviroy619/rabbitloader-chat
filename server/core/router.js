'use strict';

/**
 * Message router - maps user messages to ACTION or QNA
 * Returns: { route: 'ACTION', actionId: 'subscription_v2' } or { route: 'QNA' }
 */

const { policyGate } = require('./policy');
const { actions } = require('./actions/registry');

// very light heuristic; vectors can be plugged in later
const API_HINT = /\b(plan|usage|overview|pageviews|canonical|subscription|profile|team|domain|css|rules)\b/i;

function routeMessage(userMsg) {
  const policy = policyGate(userMsg);
  if (policy.force === 'QNA') return { route: 'QNA', policyNote: policy.note };

  const looksAction = API_HINT.test(userMsg || '');
  if (!looksAction) return { route: 'QNA', policyNote: null };

  // naive mapping by keywords to allowed actions
  const map = [
    { re: /plan|usage/i, id: 'plan_usage_v2' },
    { re: /overview/i, id: 'report_overview_v1' },
    { re: /pageviews?/i, id: 'pageviews_v2' },
    { re: /canonical/i, id: 'canonical_urls_v1' },
    { re: /subscription/i, id: 'subscription_v2' },
    { re: /profile/i, id: 'profile_v2' },
    { re: /team/i, id: 'team_members_v2' },
    { re: /domain/i, id: 'domain_info_v2' },
    { re: /css.*urls?/i, id: 'css_urls_v1' },
    { re: /css/i, id: 'css_report_v1' },
    { re: /rules/i, id: 'page_rules_v2' },
  ];
  const hit = map.find(m => m.re.test(userMsg));
  const actionId = hit?.id && actions[hit.id] ? hit.id : null;

  if (!actionId) return { route: 'QNA', policyNote: null };
  return { route: 'ACTION', actionId, policyNote: null };
}

module.exports = { routeMessage };