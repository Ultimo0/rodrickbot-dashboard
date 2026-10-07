import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { sessionIdFromCookieHeader } from '../src/utils/sessionCookie.js';

const secret = 'test-session-secret';

function signedCookie(sessionId) {
  const signature = createHmac('sha256', secret)
    .update(sessionId)
    .digest('base64')
    .replace(/=+$/, '');
  return encodeURIComponent(`s:${sessionId}.${signature}`);
}

test('extracts a valid express-session cookie from a cookie header', () => {
  const header = `theme=dark; connect.sid=${signedCookie('abc123')}; locale=fr`;
  assert.equal(sessionIdFromCookieHeader(header, secret), 'abc123');
});

test('rejects missing, unsigned, malformed, and forged session cookies', () => {
  assert.equal(sessionIdFromCookieHeader('', secret), null);
  assert.equal(sessionIdFromCookieHeader('connect.sid=abc123', secret), null);
  assert.equal(sessionIdFromCookieHeader('connect.sid=s:abc123.invalid', secret), null);
  assert.equal(sessionIdFromCookieHeader(`connect.sid=${signedCookie('abc123')}`, 'wrong-secret'), null);
});
