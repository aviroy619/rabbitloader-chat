const DESTRUCTIVE_VERBS = /\b(delete|remove|disable|drop|destroy|erase|purge)\b/i;
const SENSITIVE_OBJECTS = /\b(website|site|profile|account|team|rule|domain)\b/i;

function policyGate(userMsg) {
  if (!userMsg) return { force: null, note: null };
  if (DESTRUCTIVE_VERBS.test(userMsg) && SENSITIVE_OBJECTS.test(userMsg)) {
    return { force: 'QNA', note: 'Action blocked in chat. Use Console.' };
  }
  return { force: null, note: null };
}

module.exports = { policyGate };
