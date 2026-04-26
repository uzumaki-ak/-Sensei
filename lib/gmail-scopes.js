const REQUIRED_GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
];

function normalizeScopeList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((scope) => String(scope || "").trim()).filter(Boolean);
  }
  return String(raw)
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function getGmailScopes(gmailToken) {
  if (!gmailToken || typeof gmailToken !== "object") return [];
  const directScopes = normalizeScopeList(gmailToken.scope || gmailToken.scopes);
  if (directScopes.length) return directScopes;

  // Some OAuth providers nest scope metadata under metadata fields.
  return normalizeScopeList(
    gmailToken?.metadata?.scope || gmailToken?.metadata?.scopes
  );
}

export function hasGmailDraftScope(gmailToken) {
  const scopes = getGmailScopes(gmailToken);
  if (!scopes.length) return false;
  return REQUIRED_GMAIL_SCOPES.every((scope) => scopes.includes(scope));
}

export function getGmailAuthState(gmailToken) {
  const isConnected = Boolean(gmailToken);
  const hasRequiredScopes = hasGmailDraftScope(gmailToken);
  return {
    isConnected,
    hasRequiredScopes,
    needsReconnect: isConnected && !hasRequiredScopes,
  };
}

