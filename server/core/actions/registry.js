'use strict';

/**
 * Read-only ACTION catalog.
 * Only include endpoints we have confirmed with real curls.
 */
const actions = {
  // V1: Overview (CONFIRMED)
  // GET https://api-v1.rabbitloader.com/api/v1/report/overview?domain=<host>&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
  report_overview_v1: {
    id: 'report_overview_v1',
    title: 'Report overview',
    safety: { destructive: false },
    needs: ['jwt'], // NOT using x-domain-id for this endpoint
    endpoint: { service: 'v1', method: 'GET', path: '/api/v1/report/overview' },
    params: {
      domain:     { in: 'query', type: 'string', required: true },   // e.g., rabbitloader.com
      start_date: { in: 'query', type: 'string', required: true },   // YYYY-MM-DD
      end_date:   { in: 'query', type: 'string', required: true }    // YYYY-MM-DD
    },
    formatter: 'overview',
    examples: [
      'overview for rabbitloader.com 2025-07-30 to 2025-08-27',
      'overview last 30 days'
    ]
  },

  // V1: Canonical URLs (CONFIRMED)
  // GET https://api-v1.rabbitloader.com/api/v1/report/canonical_urls
  canonical_urls_v1: {
    id: 'canonical_urls_v1',
    title: 'Canonical URLs report',
    safety: { destructive: false },
    needs: ['jwt'],
    endpoint: { service: 'v1', method: 'GET', path: '/api/v1/report/canonical_urls' },
    params: {
      domain: { in: 'query', type: 'string', required: true },
      draw: { in: 'query', type: 'number', required: false },
      start: { in: 'query', type: 'number', required: false },
      length: { in: 'query', type: 'number', required: false },
      'search[value]': { in: 'query', type: 'string', required: false },
      'order[0][column]': { in: 'query', type: 'number', required: false },
      'order[0][dir]': { in: 'query', type: 'string', required: false },
      'columns[0][data]': { in: 'query', type: 'string', required: false },
      'columns[0][searchable]': { in: 'query', type: 'string', required: false },
      'columns[0][orderable]': { in: 'query', type: 'string', required: false },
      'columns[1][data]': { in: 'query', type: 'string', required: false },
      'columns[1][searchable]': { in: 'query', type: 'string', required: false },
      'columns[1][orderable]': { in: 'query', type: 'string', required: false },
      'columns[2][data]': { in: 'query', type: 'string', required: false },
      'columns[2][searchable]': { in: 'query', type: 'string', required: false },
      'columns[2][orderable]': { in: 'query', type: 'string', required: false }
    },
    formatter: 'canonicalUrls',
    examples: [
      'show canonical urls',
      'canonical urls report',
      'url optimization status'
    ]
  },

  // V2: Subscription (CONFIRMED)
  // GET https://api-v2.rabbitloader.com/billing/subscription?get_params=CgEBEAE%3D
  subscription_v2: {
    id: 'subscription_v2',
    title: 'Subscription details',
    safety: { destructive: false },
    needs: ['jwt'],
    endpoint: { service: 'v2', method: 'GET', path: '/billing/subscription' },
    params: {
      get_params: { in: 'query', type: 'string', required: false }
    },
    formatter: 'subscription',
    examples: [
      'show subscription',
      'billing details',
      'plan information'
    ]
  },

  // V2: Profile (CONFIRMED)
  // GET https://api-v2.rabbitloader.com/user/v2/this-profile?get_params=
  profile_v2: {
    id: 'profile_v2',
    title: 'User profile',
    safety: { destructive: false },
    needs: ['jwt'],
    endpoint: { service: 'v2', method: 'GET', path: '/user/v2/this-profile' },
    params: {
      get_params: { in: 'query', type: 'string', required: false }
    },
    formatter: 'profile',
    examples: [
      'show profile',
      'my account',
      'user details'
    ]
  },

  // V2: Pageviews (CONFIRMED)
  // GET https://api-v2.rabbitloader.com/domain/pageview/{domainId}?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
  pageviews_v2: {
    id: 'pageviews_v2',
    title: 'Pageviews report',
    safety: { destructive: false },
    needs: ['jwt', 'domainId'],
    endpoint: { service: 'v2', method: 'GET', path: '/domain/pageview/{domainId}' },
    params: {
      start_date: { in: 'query', type: 'string', required: true },   // YYYY-MM-DD
      end_date: { in: 'query', type: 'string', required: true }      // YYYY-MM-DD
    },
    formatter: 'pageviews',
    examples: [
      'pageviews last 30 days',
      'traffic report',
      'daily pageviews'
    ]
  },

  // V2: Domain Info (CONFIRMED)
  // GET https://api-v2.rabbitloader.com/url/domain/{domainId}/info
  domain_info_v2: {
    id: 'domain_info_v2',
    title: 'Domain information',
    safety: { destructive: false },
    needs: ['jwt', 'domainId'],
    endpoint: { service: 'v2', method: 'GET', path: '/url/domain/{domainId}/info' },
    params: {},
    formatter: 'domainInfo',
    examples: [
      'domain info',
      'site performance',
      'optimization stats'
    ]
  },

  // V2: Plan Usage (CONFIRMED)
  // GET https://api-v2.rabbitloader.com/domain/plan_usage/{domainId}?get_params=CAE%3D
  plan_usage_v2: {
    id: 'plan_usage_v2',
    title: 'Plan usage',
    safety: { destructive: false },
    needs: ['jwt', 'domainId'],
    endpoint: { service: 'v2', method: 'GET', path: '/domain/plan_usage/{domainId}' },
    params: {
      get_params: { in: 'query', type: 'string', required: false }
    },
    formatter: 'planUsage',
    examples: [
      'plan usage',
      'quota status',
      'usage limits'
    ]
  },

  // V1: CSS Report (CONFIRMED)
  // GET https://api-v1.rabbitloader.com/api/v1/report/css?domain=<host>
  css_report_v1: {
    id: 'css_report_v1',
    title: 'CSS optimization report',
    safety: { destructive: false },
    needs: ['jwt'],
    endpoint: { service: 'v1', method: 'GET', path: '/api/v1/report/css' },
    params: {
      domain: { in: 'query', type: 'string', required: true }
    },
    formatter: 'cssReport',
    examples: [
      'css report',
      'css optimization',
      'stylesheet stats'
    ]
  },

  // V1: CSS by URLs (CONFIRMED)
  // GET https://api-v1.rabbitloader.com/api/v1/report/css_urls
  css_urls_v1: {
    id: 'css_urls_v1',
    title: 'CSS by URLs report',
    safety: { destructive: false },
    needs: ['jwt'],
    endpoint: { service: 'v1', method: 'GET', path: '/api/v1/report/css_urls' },
    params: {
      domain: { in: 'query', type: 'string', required: true },
      draw: { in: 'query', type: 'number', required: false },
      start: { in: 'query', type: 'number', required: false },
      length: { in: 'query', type: 'number', required: false },
      'search[value]': { in: 'query', type: 'string', required: false },
      'order[0][column]': { in: 'query', type: 'number', required: false },
      'order[0][dir]': { in: 'query', type: 'string', required: false },
      'columns[0][data]': { in: 'query', type: 'string', required: false },
      'columns[0][searchable]': { in: 'query', type: 'string', required: false },
      'columns[0][orderable]': { in: 'query', type: 'string', required: false },
      'columns[1][data]': { in: 'query', type: 'string', required: false },
      'columns[1][searchable]': { in: 'query', type: 'string', required: false },
      'columns[1][orderable]': { in: 'query', type: 'string', required: false },
      'columns[2][data]': { in: 'query', type: 'string', required: false },
      'columns[2][searchable]': { in: 'query', type: 'string', required: false },
      'columns[2][orderable]': { in: 'query', type: 'string', required: false },
      'columns[3][data]': { in: 'query', type: 'string', required: false },
      'columns[3][searchable]': { in: 'query', type: 'string', required: false },
      'columns[3][orderable]': { in: 'query', type: 'string', required: false },
      'columns[4][data]': { in: 'query', type: 'string', required: false },
      'columns[4][searchable]': { in: 'query', type: 'string', required: false },
      'columns[4][orderable]': { in: 'query', type: 'string', required: false }
    },
    formatter: 'cssUrls',
    examples: [
      'css by urls',
      'css breakdown',
      'url css sizes'
    ]
  },

  // V2: Page Rules (CONFIRMED)
  // GET https://api-v2.rabbitloader.com/url/page-rule/{domainId}
  page_rules_v2: {
    id: 'page_rules_v2',
    title: 'Current page rules',
    safety: { destructive: false },
    needs: ['jwt', 'domainId'],
    endpoint: { service: 'v2', method: 'GET', path: '/url/page-rule/{domainId}' },
    params: {},
    formatter: 'pageRules',
    examples: [
      'page rules',
      'optimization rules',
      'current rules'
    ]
  },

  // V2: Team Members (CONFIRMED)
  // GET https://api-v2.rabbitloader.com/domain/v2/{domainId}/team
  team_members_v2: {
    id: 'team_members_v2',
    title: 'Team members',
    safety: { destructive: false },
    needs: ['jwt', 'domainId'],
    endpoint: { service: 'v2', method: 'GET', path: '/domain/v2/{domainId}/team' },
    params: {},
    formatter: 'teamMembers',
    examples: [
      'team members',
      'user access',
      'domain team'
    ]
  }
};

module.exports = { actions };