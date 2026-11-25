import catalog from '../../../booking/catalog.js';
export { catalog };
export const shop = '138 Wescar Lane, Unit 2, Kanata';
export function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
export function text(value, max = 300, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail('Please complete all required fields.');
  return value.trim();
}
export function email(value) {
  const result = text(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail('Enter a valid email address.');
  return result;
}
export function contact(value) {
  if (!value || typeof value !== 'object') fail('Enter your contact details.');
  const phone = text(value.phone, 30);
  if (!/^[+\d()\s.-]+$/.test(phone) || phone.replace(/\D/g, '').length < 10) fail('Enter a valid phone number.');
  return { fullName: text(value.fullName, 100), phone, email: email(value.email), notes: text(value.notes || '', 2000, false) };
}
export function dateNow() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || !Number.isFinite(+new Date(value + 'T12:00:00Z')) || new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) !== value || value < dateNow() || value > String(Number(dateNow().slice(0, 4)) + 1) + dateNow().slice(4)) fail('Choose a date within the next year.');
  return value;
}
export function pastSlot(date, time) {
  const now = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).replace(':', '') + '00';
  return date < dateNow() || (date === dateNow() && time <= now);
}
export function cars(input) {
  if (!Array.isArray(input) || !input.length || input.length > 3) fail('An appointment can take up to 3 vehicles.');
  return input.map(item => {
    if (!Number.isInteger(item.packageId) || !catalog.packages[item.packageId] || item.packageId === 4) fail('Choose a booking package. Paint correction requires a quote.');
    if (!Number.isInteger(item.vehicleType) || !catalog.vehicles[item.vehicleType] || (item.vehicleType === 5 && item.packageId !== 3)) fail('Choose a valid vehicle type.');
    const addons = {};
    if (!item.addons || typeof item.addons !== 'object' || Array.isArray(item.addons)) fail('Invalid add-ons.');
    for (const [id, count] of Object.entries(item.addons)) {
      if (!/^\d+$/.test(id) || !catalog.extras[id] || !Number.isInteger(count) || count < 0 || count > catalog.extraMax(item, Number(id))) fail('Invalid add-on quantity.');
      if (count) addons[id] = count;
    }
    return { packageId: item.packageId, vehicleType: item.vehicleType, model: text(item.model, 100), addons };
  });
}
export function location(input, selectedCars) {
  if (!['shop', 'mobile'].includes(input.location)) fail('Choose shop or mobile service.');
  if (selectedCars.some(item => item.packageId === 5) && input.location !== 'mobile') fail('Tire swaps require mobile service.');
  if (input.location === 'shop') return { location: 'shop', address: shop };
  const a = input.address || {};
  const postal = text(a.postal, 7).toUpperCase();
  if (!/^[A-Z]\d[A-Z] ?\d[A-Z]\d$/.test(postal)) fail('Enter a valid Canadian postal code.');
  return { location: 'mobile', address: { street: text(a.street, 150), unit: text(a.unit || '', 50, false), city: text(a.city, 80), postal } };
}
export function booking(input) {
  const selectedCars = cars(input.vehicles);
  const place = location(input, selectedCars);
  const date = validDate(input.date);
  let slot;
  if (input.customTime) {
    if (!/^(?:0[8-9]|1\d|2[01]):[0-5]\d$/.test(input.customTime)) fail('Choose a custom time between 8 AM and 10 PM.');
    if (pastSlot(date, input.customTime.replace(':', '') + '00')) fail('Choose a future time.');
    slot = { id: 'custom', label: input.customTime, custom: true };
  } else {
    slot = catalog.slots(date).find(slot => slot.id === input.slotId);
    if (!slot || pastSlot(date, slot.time)) fail('Choose an available future time.');
  }
  if (input.cancellationAccepted !== true) fail('Accept the cancellation policy.');
  return { vehicles: selectedCars, ...place, date, slot, contact: contact(input.contact), cancellationAccepted: true };
}
export function quote(input) {
  const result = { contact: contact(input), date: validDate(input.date) };
  for (const key of ['vehicleType', 'make', 'model', 'colour']) result[key] = text(input[key], 80);
  result.year = text(String(input.year), 4);
  if (!/^\d{4}$/.test(result.year) || +result.year < 1900 || +result.year > 2100) fail('Enter a valid vehicle year.');
  result.condition = text(input.condition, 1000);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.time || '')) fail('Enter a preferred time.');
  result.time = input.time;
  if (!['shop', 'mobile'].includes(input.location)) fail('Choose shop or mobile service.');
  result.location = input.location;
  result.address = input.location === 'mobile' ? text(input.address, 300) : shop;
  return result;
}
// One atomic slot record holds all reservations. Retries reuse their reservation.
export async function reserve(store, slotId, reservationId, count) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const record = await store.getWithMetadata(slotId, { type: 'json' });
    const reservations = record?.data || {};
    if (reservations[reservationId]) return;
    if (Object.values(reservations).reduce((a, b) => a + b, 0) + count > 3) fail('That time no longer has enough room. Choose another slot.', 409);
    const result = await store.setJSON(slotId, { ...reservations, [reservationId]: count }, record ? { onlyIfMatch: record.etag } : { onlyIfNew: true });
    if (result.modified) return;
  }
  fail('Availability changed. Please try again.', 409);
}
