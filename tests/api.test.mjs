import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/api.mjs';
import { catalog } from '../netlify/functions/lib/rules.mjs';

test('API verifies payments, enforces capacity, retries email safely, and delivers quotes', async () => {
  const originalFetch = globalThis.fetch, originalContext = globalThis.netlifyBlobsContext;
  const savedEnv = { ...process.env };
  const objects = new Map(), messages = [], checkouts = [];
  let version = 0, paymentComplete = false, rejectNextOwnerEmail = false;
  globalThis.netlifyBlobsContext = Buffer.from(JSON.stringify({ siteID: 'test-site', token: 'test-token', edgeURL: 'https://blobs.test', uncachedEdgeURL: 'https://blobs.test' })).toString('base64');
  Object.assign(process.env, { CONTEXT: 'test', STRIPE_SECRET_KEY: 'sk_test_fake', RESEND_API_KEY: 're_fake', BOOKING_FROM_EMAIL: 'bookings@example.com', BOOKING_OWNER_EMAIL: 'owner@example.com', SITE_ORIGIN: 'https://noble.test' });
  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(url), method = (options.method || 'GET').toUpperCase();
    if (parsed.hostname === 'blobs.test') {
      const key = parsed.pathname, current = objects.get(key), headers = new Headers(options.headers);
      if (method === 'GET') return current ? new Response(current.body, { headers: { etag: current.etag } }) : new Response(null, { status: 404 });
      if ((headers.has('if-match') && headers.get('if-match') !== current?.etag) || (headers.get('if-none-match') === '*' && current)) return new Response(null, { status: 412 });
      const etag = String(++version);
      objects.set(key, { body: options.body, etag });
      return new Response(null, { headers: { etag } });
    }
    if (parsed.hostname === 'api.stripe.com') {
      if (method === 'POST') {
        checkouts.push(new URLSearchParams(options.body));
        return Response.json({ id: 'cs_test_checkout', url: 'https://checkout.stripe.com/test' });
      }
      if (parsed.pathname.includes('/checkout/sessions/')) return Response.json({ status: paymentComplete ? 'complete' : 'open', payment_status: paymentComplete ? 'paid' : 'unpaid', amount_total: 1695, currency: 'cad', customer_email: 'test@example.com', subscription: 'sub_test' });
      if (parsed.pathname.includes('/subscriptions/')) return Response.json({ status: 'active' });
    }
    if (parsed.hostname === 'api.resend.com') {
      const body = JSON.parse(options.body);
      if (rejectNextOwnerEmail && body.to[0] === 'owner@example.com') { rejectNextOwnerEmail = false; return Response.json({ error: 'temporary failure' }, { status: 500 }); }
      messages.push(body);
      return Response.json({ id: 'mail-' + messages.length });
    }
    throw new Error('Unexpected network call: ' + url);
  };
  try {
    let cookie = '';
    const call = async (path, body) => {
      const response = await handler(new Request('https://noble.test/api' + path, { method: body ? 'POST' : 'GET', headers: { origin: 'https://noble.test', 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined }), { ip: '127.0.0.1' });
      if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      return { status: response.status, body: await response.json() };
    };
    assert.equal((await call('/membership/checkout', { email: 'test@example.com' })).status, 200);
    assert.equal(checkouts[0].get('line_items[0][price_data][unit_amount]'), '1695');
    assert.equal(checkouts[0].get('line_items[0][price_data][recurring][interval]'), 'year');
    assert.deepEqual((await call('/session')).body, { signedIn: false, membershipActive: false });
    const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const input = { vehicles: [{ packageId: 2, vehicleType: 0, model: 'Toyota Camry', addons: {} }], location: 'shop', date, slotId: catalog.slots(date)[0].id, contact: { fullName: 'Customer', phone: '6135550123', email: 'test@example.com' }, cancellationAccepted: true, membershipActive: true, idempotencyKey: 'first-booking-12345' };
    const first = await call('/bookings', input);
    assert.equal(first.status, 200);
    assert.equal(first.body.membershipActive, false);
    assert.equal(first.body.total, 289);
    assert.equal(messages[0].to[0], 'owner@example.com');
    const availability = vehicles => call('/availability', { month: date.slice(0, 7), vehicles });
    const hasSlot = (result, slotId = input.slotId) => result.body.dates[date].some(slot => slot.id === slotId);
    const nextSlotId = catalog.slots(date)[1].id;
    assert.ok(hasSlot(await availability(input.vehicles)));
    assert.ok(!hasSlot(await availability([...input.vehicles, ...input.vehicles])));
    assert.ok(hasSlot(await availability([...input.vehicles, ...input.vehicles]), nextSlotId));
    paymentComplete = true;
    assert.equal((await call('/session')).body.membershipActive, true);
    const member = await call('/bookings', { ...input, idempotencyKey: 'second-booking-12345' });
    assert.equal(member.body.total, 259);
    assert.equal(member.body.membershipActive, true);
    rejectNextOwnerEmail = true;
    const thirdPayload = { ...input, vehicles: [...input.vehicles, ...input.vehicles], slotId: nextSlotId, idempotencyKey: 'third-booking-12345' };
    assert.equal((await call('/bookings', thirdPayload)).status, 503);
    assert.equal((await call('/bookings', thirdPayload)).status, 200);
    assert.equal((await call('/bookings', thirdPayload)).status, 200);
    assert.equal(messages.length, 3);
    assert.equal((await call('/bookings', { ...input, idempotencyKey: 'fourth-booking-12345' })).status, 409);
    const remaining = await availability(input.vehicles);
    assert.ok(!hasSlot(remaining));
    assert.ok(!hasSlot(remaining, nextSlotId));
    const q = await call('/quotes', { ...input.contact, vehicleType: 'Sedan', year: '2020', make: 'Toyota', model: 'Camry', colour: 'Black', condition: 'Swirls', location: 'mobile', address: '123 Main Street, Ottawa', date, time: '15:00', notes: 'Call first', idempotencyKey: 'quote-request-12345' });
    assert.equal(q.status, 200);
    assert.match(messages.at(-1).text, /Paint concerns: Swirls/);
    assert.match(messages.at(-1).text, /Notes: Call first/);
    assert.match(messages.at(-1).subject, /Paint correction quote/);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.netlifyBlobsContext = originalContext;
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
  }
});
