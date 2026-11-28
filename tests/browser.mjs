import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import catalog from '../booking/catalog.js';

const root = path.resolve(import.meta.dirname, '..');
const server = createServer(async (req, res) => {
  try {
    const filename = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!filename.startsWith(root + path.sep)) throw new Error('Invalid path');
    const data = await readFile(filename);
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(filename)] || 'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('https://checkout.stripe.test/**', route => route.fulfill({ contentType: 'text/html', body: 'Mock secure checkout' }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let payload, paid = false;
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const input = route.request().method() === 'POST' ? route.request().postDataJSON() : {};
    let body = {};
    if (pathname === '/api/session') body = { signedIn: paid, membershipActive: paid };
    if (pathname === '/api/availability') {
      const [year, month] = input.month.split('-').map(Number);
      const date = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      body = { dates: { [date]: catalog.slots(date) } };
    }
    if (pathname === '/api/bookings') {
      payload = input;
      body = { reference: 'TEST-BOOKING', ...catalog.price(input.vehicles, input.location, paid), membershipActive: paid, pending: !!input.customTime };
    }
    if (pathname === '/api/quotes') { payload = input; body = { reference: 'TEST-QUOTE' }; }
    if (pathname === '/api/membership/checkout') body = { checkoutUrl: 'https://checkout.stripe.test/payment-return.html' };
    await route.fulfill({ json: body });
  });
  const click = action => page.locator(`[data-action="${action}"]`).first().click();
  const next = () => page.locator('#step-form button[type="submit"]').click();
  const fill = (name, value) => page.locator(`[name="${name}"]`).fill(value);
  const choosePackage = id => page.locator(`button[data-action="package"][data-value="${id}"]`).click();
  await page.goto(base + '/booking/embed.html');
  await page.waitForFunction(() => !document.querySelector('button:disabled'));
  assert.deepEqual(await page.locator('.card h2').allTextContents(), [2, 1, 0, 3, 4, 5].map(id => catalog.packages[id][0]));
  assert.equal(await page.locator('[data-action="next"]').count(), 0);
  assert.ok(!(await page.locator('.card').filter({ hasText: 'Paint Correction' }).innerText()).includes('$'));
  await choosePackage(2);
  await fill('model', 'Toyota Camry'); await next();
  await page.locator('[name="location"][value="shop"]').check(); await next();
  await page.locator('[data-action="date"]:not(:disabled)').last().click();
  await expect(page.locator('[data-action="slot"]')).toHaveText(['9:30 AM', '12:00 PM', '2:00 PM', '4:00 PM', '6:00 PM']);
  await click('slot'); await next();
  await fill('fullName', 'Test Customer'); await fill('phone', '6135550123'); await fill('email', 'test@example.com'); await next();
  await click('join');
  const popupPromise = page.waitForEvent('popup');
  await click('pay');
  const popup = await popupPromise; await popup.waitForURL('**/payment-return.html'); await popup.close();
  await click('verify-payment');
  await expect(page.locator('#status')).toHaveText(/not active/);
  paid = true; await click('verify-payment'); await expect(page.locator('h1')).toHaveText('A little extra care?');
  for (let i = 0; i < 4; i++) await page.locator('[data-action="extra-plus"][data-value="10"]').click();
  assert.equal(await page.locator('[data-action="extra-plus"][data-value="10"]').isDisabled(), true);
  await next();
  assert.match(await page.locator('.panel').innerText(), /Want to add another car/);
  await click('review-add-car'); await choosePackage(3);
  await page.locator('[name="vehicleType"][value="4"]').check();
  await fill('model', 'Honda CR-V'); await next();
  await page.locator('[data-action="extra-plus"][data-value="12"]').click(); await next();
  await expect(page.locator('[data-action="review-add-car"]')).toHaveCount(0);
  assert.equal(await page.locator('.total-lines').getByText(/multi-car discount/).count(), 2);
  assert.match(await page.locator('.panel h2').first().innerText(), /\$782/);
  await page.locator('[name="agreed"]').check(); await next();
  await expect(page.locator('h1')).toHaveText(/booked/);
  assert.equal(payload.vehicles.length, 2);
  assert.equal(payload.vehicles[0].addons['10'], 4);
  assert.equal(payload.vehicles[1].addons['12'], 1);
  assert.equal(payload.date.length, 10);

  // Paint correction has its own form and never visits Club or add-ons.
  paid = false;
  await page.reload(); await choosePackage(4);
  for (const [name, value] of Object.entries({ vehicleType: 'Sedan', year: '2020', make: 'Toyota', model: 'Camry', colour: 'Black', condition: 'Swirls and faded paint', date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), time: '14:30', fullName: 'Quote Customer', phone: '6135550123', email: 'quote@example.com' })) await fill(name, value);
  await next();
  await expect(page.locator('h1')).toHaveText(/quote request was sent/);
  assert.equal(payload.condition, 'Swirls and faded paint');
  assert.ok(!payload.vehicles);

  // Custom time survives navigation and is submitted as a request.
  await page.reload(); await choosePackage(0); await fill('model', 'Honda Civic'); await next();
  await page.locator('[name="location"][value="shop"]').check(); await next();
  await page.locator('[data-action="date"]:not(:disabled)').last().click();
  await fill('customTime', '14:15'); await next();
  await fill('fullName', 'Custom Customer'); await fill('phone', '6135550123'); await fill('email', 'custom@example.com'); await next();
  await click('skip-club'); await click('skip-addons');
  await page.locator('[name="agreed"]').check(); await next();
  await expect(page.locator('h1')).toHaveText(/time request was sent/);
  assert.equal(payload.customTime, '14:15');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload(); await page.screenshot({ path: path.join(root, 'test-results', 'packages-mobile.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: path.join(root, 'test-results', 'packages-desktop.png'), fullPage: true });
  const embedded = page.frameLocator('#booking-frame');
  for (const name of ['Explore Packages', 'Price Calculator']) {
    await page.goto(base + '/index.html');
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(base + '/booking.html');
    await expect(embedded.locator('.card')).toHaveCount(6);
  }
  await page.locator('[data-booking-quote]').first().click();
  await expect(embedded.locator('h1')).toHaveText('Request a paint correction quote.');
  assert.equal(await page.locator('#quoteModal').getAttribute('aria-hidden'), 'true');
  await embedded.getByRole('link', { name: 'Need help?' }).click();
  await expect(page).toHaveURL(base + '/contact.html');
  await expect(page.locator('header.nav-wrapper')).toHaveCount(1);
  await expect(page.locator('footer.footer-clean')).toHaveCount(1);
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: homepage links, arrival times, two-car limit, package order, automatic advance, verified Club gate, counters, multi-car totals, separate quote, custom time, mobile layout, and Need help navigation. API responses were mocked.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
