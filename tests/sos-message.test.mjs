import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Utils/sos-message.js', import.meta.url), 'utf8');
const { normalizeWhatsAppPhone, buildSosMessage, buildWhatsAppSosUrl } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('WhatsApp phone numbers use international digits, including local South African contacts', () => {
  assert.equal(normalizeWhatsAppPhone('+27 82 123 4567'), '27821234567');
  assert.equal(normalizeWhatsAppPhone('082 123 4567'), '27821234567');
  assert.equal(normalizeWhatsAppPhone('0044 7700 900123'), '447700900123');
  assert.equal(normalizeWhatsAppPhone(''), null);
  assert.equal(normalizeWhatsAppPhone('123'), null);
});

test('WhatsApp message preserves clickable HTTPS maps, line breaks and special characters', () => {
  const alert = { userName: 'A & B', location: { currentLocation: { latitude: 0, longitude: -26.1 } } };
  const url = new URL(buildWhatsAppSosUrl({ contact: { phone: '+27821234567' }, alert, trackingUrl: 'pinpoint://sos/private-token' }));
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/27821234567');
  const message = url.searchParams.get('text');
  assert.match(message, /A & B/);
  assert.match(message, /https:\/\/www.google.com\/maps\?q=0,-26.1/);
  assert.match(message, /Location at time of sharing:\n/);
  assert.doesNotMatch(message, /pinpoint:|private-token|Live tracking:/);
});

test('HTTPS live tracking is included when available; missing locations are honest', () => {
  const message = buildSosMessage({ alert: {}, trackingUrl: 'https://example.com/sos/123?token=abc' });
  assert.match(message, /Live tracking:\nhttps:\/\/example.com\/sos\/123\?token=abc/);
  assert.match(message, /Location is currently unavailable/);
  assert.throws(() => buildWhatsAppSosUrl({ contact: { phone: '' }, alert: {} }), /valid phone number/);
});

test('iOS and Android open WhatsApp directly with the live tracking link', () => {
  const trackingUrl = 'https://example.com/sos/123?token=abc';
  for (const platform of ['ios', 'android']) {
    const url = new URL(buildWhatsAppSosUrl({ platform, contact: { phone: '0821234567' }, alert: {}, trackingUrl }));
    assert.equal(url.protocol, 'whatsapp:');
    assert.equal(url.hostname, 'send');
    assert.equal(url.searchParams.get('phone'), '27821234567');
    assert.ok(url.searchParams.get('text').includes(trackingUrl));
  }
});
