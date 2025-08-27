const required = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
};
const num = (k, d) => {
  const v = process.env[k] ?? d;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`Invalid number for ${k}: ${v}`);
  return n;
};

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'production',
  port: num('PORT', 3006),

  openai: {
    apiKey: required('OPENAI_API_KEY'),
    chatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    embedModel: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
  },

  pinecone: {
    apiKey: required('PINECONE_API_KEY'),
    environment: process.env.PINECONE_ENVIRONMENT || process.env.PINECONE_ENV,
    indexKb: process.env.PINECONE_INDEX_KB || process.env.PINECONE_INDEX_NAME,
    indexActions: process.env.PINECONE_INDEX_ACTIONS || process.env.PINECONE_INDEX_NAME,
    nsKb: required('PINECONE_NAMESPACE_KB'),
    nsActions: required('PINECONE_NAMESPACE_ACTIONS'),
    nsPriorityQa: required('PINECONE_NAMESPACE_PRIORITY_QA'),
  },

    // RL API bases (versioned)
  rl: {
    v1Base: process.env.RL_API_V1_BASE || 'https://api-v1.rabbitloader.com',
    v2Base: process.env.RL_API_V2_BASE || 'https://api-v2.rabbitloader.com',
    // legacy fallback if you need it:
    baseUrl: process.env.RL_API_BASE || ''
  },


  logDir: process.env.LOG_DIR || './logs',
  adminEmail: process.env.ADMIN_EMAIL || '',
  flowDebug: ['1','true','yes'].includes(String(process.env.FLOW_DEBUG||'').toLowerCase()),
  mongoUri: process.env.MONGODB_URI || '',
};
