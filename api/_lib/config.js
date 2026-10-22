// One deployment contract for the optional account feature. A partially
// configured account stack is worse than no account UI: it sends the user into
// an OAuth flow that can only fail later.

export class AccountsNotConfigured extends Error {
  constructor(missing = []) {
    super(`Accounts are not fully configured. Missing: ${missing.join(', ')}`);
    this.name = 'AccountsNotConfigured';
    this.missing = missing;
  }
}

function present(name) {
  return Boolean(process.env[name] && process.env[name].trim());
}

export function accountConfiguration() {
  const required = ['DATABASE_URL', 'AUTH_SECRET', 'AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET'];
  if (process.env.NODE_ENV === 'production') required.push('AUTH_URL');
  const missing = required.filter((name) => !present(name));
  return { configured: missing.length === 0, missing };
}

export function isAccountsConfigured() {
  return accountConfiguration().configured;
}

export function requireAccountsConfigured() {
  const status = accountConfiguration();
  if (!status.configured) throw new AccountsNotConfigured(status.missing);
}

/**
 * Canonical OAuth origin. Production must use AUTH_URL so Host / forwarded Host
 * headers can never choose an OAuth redirect URI. Local development may derive
 * the origin from the request to keep `vercel dev` frictionless.
 */
export function authOrigin(req) {
  const configured = process.env.AUTH_URL && process.env.AUTH_URL.trim();
  if (configured) {
    // A malformed AUTH_URL must be reported as a configuration problem, not as
    // an unexpected TypeError: the raw throw became a 500, and through the
    // fail-closed origin guard it turned into a 403 on every mutating request
    // with nothing in the response to explain why.
    let parsed;
    try {
      parsed = new URL(configured);
    } catch {
      throw new AccountsNotConfigured(['a valid AUTH_URL']);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new AccountsNotConfigured(['valid AUTH_URL']);
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      throw new AccountsNotConfigured(['HTTPS AUTH_URL']);
    }
    return parsed.origin;
  }

  if (process.env.NODE_ENV === 'production') throw new AccountsNotConfigured(['AUTH_URL']);
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host || !['http', 'https'].includes(proto)) throw new AccountsNotConfigured(['valid local request origin']);
  const parsed = new URL(`${proto}://${host}`);
  return parsed.origin;
}

/** Browser mutation guard. Missing Origin is allowed for non-browser clients;
 * when present it must match the canonical production origin (or local host). */
export function isCrossOriginRequest(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  let originParsed;
  try {
    originParsed = new URL(origin);
  } catch {
    // An Origin we cannot parse is refused. That is a request problem.
    return true;
  }
  const configured = process.env.AUTH_URL && process.env.AUTH_URL.trim();
  if (configured || process.env.NODE_ENV === 'production') {
    // authOrigin may throw AccountsNotConfigured. That is deliberately NOT
    // caught here: a broken AUTH_URL is a deployment problem, and the route
    // reports it as "not configured" instead of a 403 that reads like CSRF.
    return originParsed.origin !== authOrigin(req);
  }

    // Local/test servers frequently do not receive x-forwarded-proto. Compare
    // the authority here; production still uses the exact canonical origin.
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return !host || originParsed.host !== host;
}
