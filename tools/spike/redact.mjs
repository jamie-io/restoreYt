const REDACTED = '[REDACTED]';
const SENSITIVE_FIELD = /cookie|sapisid|visitor.?data|account.?id|channel.?id|token|api.?key|authorization|credential|secret/i;
const PRESENCE_FIELD = /(?:present|visible|readable|available|observed)$/i;
const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const SECRET_ASSIGNMENT = /\b((?:SAPISID(?:HASH)?|VISITOR_DATA|visitorData|access_token|refresh_token|account_id|channel[_-]?id|api_key|authorization))\s*[:=]\s*[^\s,;]+/gi;
const COOKIE_ASSIGNMENT = /\b((?:SID|HSID|SSID|APISID|SAPISID|__Secure-[\w-]+))=([^\s;,]+)/gi;
const BEARER_TOKEN = /\bBearer\s+[^\s,;]+/gi;
const CHANNEL_PATH = /(^|[\s"'(])\/channel\/[^/?#\s"'<>),.;]+/gi;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PRIVATE_PATH_SEGMENT = /^(?:vi|shorts|embed|channel|accounts?|users?|token|access_token|session|visitor|auth|api_key)$/i;

function safeUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return REDACTED;

    const segments = url.pathname.split('/');
    for (let index = 0; index < segments.length; index += 1) {
      if (PRIVATE_PATH_SEGMENT.test(segments[index - 1] || '')
        || (segments[index - 1] === 'vi' && VIDEO_ID.test(segments[index]))) {
        segments[index] = REDACTED;
      }
    }

    return `${url.protocol}//${url.host}${segments.join('/')}`;
  } catch {
    return REDACTED;
  }
}

function redactString(value) {
  return value
    .replace(BEARER_TOKEN, 'Bearer [REDACTED]')
    .replace(SECRET_ASSIGNMENT, `$1=${REDACTED}`)
    .replace(COOKIE_ASSIGNMENT, `$1=${REDACTED}`)
    .replace(CHANNEL_PATH, `$1/channel/${REDACTED}`)
    .replace(URL_PATTERN, safeUrl);
}

function redactValue(value, key = '') {
  if (SENSITIVE_FIELD.test(key)) {
    const isSafePresence = typeof value === 'boolean' && PRESENCE_FIELD.test(key);
    if (!isSafePresence) return REDACTED;
  }

  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [childKey, redactValue(childValue, childKey)]),
    );
  }
  return value;
}

export function redactEvidence(value) {
  return redactValue(value);
}

export async function writeRedactedJson(path, value) {
  const { mkdir, writeFile, rename, rm } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;

  try {
    await writeFile(temporaryPath, `${JSON.stringify(redactEvidence(value), null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}
