# Booking deployment

The maintained website is `Noble-detailing-main`. The sibling `Noble_Detailing_Booking_Code` folder and original ZIP are historical copies. Do not copy them over the updated website. `booking-source-hashes.json` records the original import.

The integrated page is `booking.html`, using `booking/embed.html` to isolate booking styles. Netlify rewrites `/booking` and `/booking/` to the integrated page. Existing `booking.html` links still work. The website navigation, footer and generic callback modal are retained.

## Activate on Netlify

1. Use this directory as the Netlify project base directory. Install with `npm ci`. The supplied config runs `npm run build`, publishes `dist/` and bundles server functions. A static drag-and-drop upload alone will not install the backend.
2. Add the following Netlify environment variables with Functions scope. See `.env.example`:
   - `STRIPE_SECRET_KEY`: first a Stripe test key, then a live key when ready.
   - `RESEND_API_KEY`: email service API key.
   - `BOOKING_FROM_EMAIL`: a sender on a domain verified in Resend.
   - `BOOKING_OWNER_EMAIL`: `almasrirame444@gmail.com` (confirmed recipient).
   - `SITE_ORIGIN`: canonical HTTPS origin, e.g. `https://nobledetailing.ca`.
3. Redeploy so Functions receive the variables. Netlify Blobs supplies persistent private storage. Data stores are separated by deploy context, keeping local/preview activity away from production.
4. Complete a Stripe test membership purchase. Return to the original booking tab and select **Check membership payment**. Verify a CAD $16.95 annual subscription charge and that discounts only apply after payment. The server retrieves payment and current subscription status directly from Stripe; this verification flow does not require a webhook. Stripe manages annual renewals. Manage cancellations/refunds in Stripe.
5. Submit a test booking and paint correction quote. Verify owner inbox receipt, including spam, and Resend delivery logs. The interface requires email-provider acceptance before reporting success. Then switch to the Stripe live key and redeploy. Cancel test subscriptions in Stripe.

No live email or payment was tested from this workspace: credentials were not supplied. The frontend uses `demo: false`. Missing integrations produce an error and the business phone number instead of a simulated confirmation. Never put secret keys in `booking/config.js`. The build copies only public files; secrets, functions, dependencies and tests stay out of `dist/`.

## Booking and pricing rules

- Package IDs remain stable. Visible order: Royal, Interior & Exterior, Interior, Ceramic, Paint Correction, Tire Swap.
- Paint Correction uses `/api/quotes`, skips membership/add-ons and does not reserve capacity.
- `booking/catalog.js` is shared by the browser/server. The server validates choices and recalculates prices.
- Each car has independent package, size, make/model and add-ons. Two cars receive $20 off each and share one address/date/slot. The $29 mobile fee is waived for two cars.
- Regular detailing size extras remain $19 for trucks and $29 for 7–8-seat SUVs/vans. Ceramic extras: sedan/coupe $0, SUV $59, truck/van $99, boat starting at $599. Final boat price depends on size and is labelled as an estimate.
- Sedan/coupe seat/carpet treatment counters cap at four each. Other vehicles allow up to eight. Headlight and rim limits remain unchanged.
- Standard arrivals are at 9:30 AM, noon, 2 PM, 4 PM, and 6 PM daily in the America/Toronto time zone.
- Each standard slot holds two cars, including multi-car bookings. Atomic conditional writes enforce capacity. Past slots are excluded.
- Custom times are requests, explicitly subject to owner confirmation. They notify the owner and do not automatically consume standard capacity or promise availability.
- Club is CAD $15 + $1.95 HST, charged as a $16.95 annual subscription. Only verified payment or verified email sign-in to an active subscription enables discounts. Subscription status is checked again when booking. Booking email must match the verified member email.
- Idempotency keys prevent duplicate bookings on retries. If email fails, the request and reserved capacity are retained; retrying the same submission resends without reserving more cars. The interface reports failure instead of success. Inspect requests in the private `noble-production-requests` Blobs store and capacity in `noble-production-slots`. Releasing cancelled capacity currently requires removing its reservation ID from the slot record in Netlify Blobs.
- Owner emails include contact details, location, date/time, vehicles/packages, per-car add-ons, discounts, total and notes. Quote emails include paint concerns. SMS, customer confirmation/reminder emails, calendar sync and an owner dashboard are not included.

## Verification

- `npm test`: nine server/rules tests, including prices, validation, payment gating, email retry, quotes and concurrent capacity. External providers are simulated.
- `npm run test:browser`: headless Microsoft Edge checks package order/advance, counters, payment gating, multi-car selection/totals, quotes, custom times and mobile overflow. API responses are simulated. Screenshots are in `test-results/`.
- `npm run build`: generate deployable public files.
- `npm run dev`: start Netlify Dev, downloading its CLI on first use. A plain static server can preview the interface but cannot process bookings.

References: [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/), [Stripe Checkout](https://docs.stripe.com/api/checkout/sessions/create), [Resend email API](https://resend.com/docs/api-reference/emails/send-email).
