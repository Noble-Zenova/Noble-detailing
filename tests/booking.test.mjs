import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, cars, booking, quote, reserve } from '../netlify/functions/lib/rules.mjs';

const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const vehicle = (patch = {}) => ({ packageId: 2, vehicleType: 0, model: 'Toyota Camry', addons: {}, ...patch });
const customer = { fullName: 'Test Customer', phone: '6135550123', email: 'test@example.com', notes: '' };
const request = () => ({ vehicles: [vehicle()], location: 'shop', date, slotId: catalog.slots(date)[0].id, contact: customer, cancellationAccepted: true });

test('ceramic pricing covers every size at regular and member rates', () => {
  for (const [vehicleType, regular, member] of [[0, 329, 299], [1, 428, 398], [2, 388, 358], [3, 428, 398], [4, 388, 358], [5, 928, 898]]) {
    assert.equal(catalog.price([vehicle({ packageId: 3, vehicleType })], 'shop', false).total, regular);
    assert.equal(catalog.price([vehicle({ packageId: 3, vehicleType })], 'shop', true).total, member);
  }
});
test('multi-car discounts and individual add-ons combine with membership savings', () => {
  const result = catalog.price([vehicle({ addons: { 10: 2 } }), vehicle({ packageId: 0, addons: { 12: 1 } })], 'mobile', true);
  assert.equal(result.total, 259 + 159 + 78 + 49 - 40);
  assert.equal(result.lines.filter(([name]) => name.includes('multi-car discount')).length, 2);
  assert.ok(!result.lines.some(([name]) => name === 'Mobile service fee'));
});
test('server caps each sedan seat/carpet treatment at four and rejects tampered quantities', () => {
  for (const id of [10, 11, 12]) {
    assert.equal(cars([vehicle({ addons: { [id]: 4 } })])[0].addons[id], 4);
    assert.throws(() => cars([vehicle({ addons: { [id]: 5 } })]), /quantity/);
  }
  assert.throws(() => cars([vehicle({ addons: { 10: -1 } })]), /quantity/);
  assert.throws(() => cars([vehicle({ addons: { 10: 1.5 } })]), /quantity/);
  assert.throws(() => cars([vehicle({ addons: { 999: 1 } })]), /quantity/);
});
test('quote packages and boats cannot bypass package validation', () => {
  assert.throws(() => cars([vehicle({ packageId: 4 })]), /quote/);
  assert.throws(() => cars([vehicle({ vehicleType: 5 })]), /vehicle/);
  assert.throws(() => cars(Array(3).fill(vehicle())), /2 vehicles/);
});
test('weekday and weekend slots use the five standard arrival times', () => {
  for (const d of ['2026-11-17', '2026-11-21']) {
    assert.deepEqual(catalog.slots(d).map(slot => slot.id), ['093000', '120000', '140000', '160000', '180000'].map(time => `${d}T${time}`));
  }
});
test('booking validates consent, mobile tire service, and custom-time requests', () => {
  assert.equal(booking(request()).vehicles.length, 1);
  assert.throws(() => booking({ ...request(), slotId: date + 'T203000' }), /available future time/);
  assert.throws(() => booking({ ...request(), cancellationAccepted: false }), /policy/);
  assert.throws(() => booking({ ...request(), vehicles: [vehicle({ packageId: 5 })] }), /mobile/);
  assert.equal(booking({ ...request(), customTime: '14:15' }).slot.custom, true);
  assert.throws(() => booking({ ...request(), customTime: '26:99' }), /custom time/);
});
test('quotes require paint details, contact details and a mobile address', () => {
  const q = { ...customer, vehicleType: 'SUV', year: '2020', make: 'Toyota', model: 'RAV4', colour: 'Blue', condition: 'Swirls', date, time: '14:00', location: 'shop' };
  assert.equal(quote(q).condition, 'Swirls');
  assert.throws(() => quote({ ...q, condition: '' }), /required/);
  assert.throws(() => quote({ ...q, location: 'mobile', address: '' }), /required/);
});
test('atomic capacity allows only two cars under concurrent requests and retries are idempotent', async () => {
  let record = null, version = 0;
  const store = {
    async getWithMetadata() { return record ? { data: structuredClone(record), etag: String(version) } : null; },
    async setJSON(key, value, options) {
      if ((options.onlyIfNew && record) || (options.onlyIfMatch && options.onlyIfMatch !== String(version))) return { modified: false };
      record = structuredClone(value); version++; return { modified: true };
    },
  };
  const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => reserve(store, 'slot', 'booking-' + i, 1)));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 2);
  assert.equal(Object.values(record).reduce((sum, value) => sum + value, 0), 2);
  const id = Object.keys(record)[0];
  await reserve(store, 'slot', id, 1);
  assert.equal(Object.keys(record).length, 2);
});
