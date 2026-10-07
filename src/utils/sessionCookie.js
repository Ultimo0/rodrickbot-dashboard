import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Valide et extrait l’identifiant du cookie signé par express-session.
 * Retourne null si le cookie manque, est mal formé ou signé avec un autre secret.
 */
export function sessionIdFromCookieHeader(cookieHeader, secret, cookieName = 'connect.sid') {
  if (typeof cookieHeader !== 'string' || !secret) return null;

  let encodedValue = null;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== cookieName) continue;
    encodedValue = part.slice(separator + 1).trim();
    break;
  }
  if (!encodedValue) return null;

  let value;
  try {
    value = decodeURIComponent(encodedValue);
  } catch {
    return null;
  }
  if (!value.startsWith('s:')) return null;

  const signedValue = value.slice(2);
  const separator = signedValue.lastIndexOf('.');
  if (separator < 1) return null;

  const sessionId = signedValue.slice(0, separator);
  const signature = signedValue.slice(separator + 1);
  const expected = createHmac('sha256', secret)
    .update(sessionId)
    .digest('base64')
    .replace(/=+$/, '');
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);

  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return null;
  return sessionId;
}
