# Client booking changes — 16 November 2026

Markers: ✅ implemented and locally checked · ⚠️ activation needs external setup.

1. ✅ **Package selection:** selecting a package advances immediately; removed the package Continue button.
2. ✅ **Package order:** Noble Royal Full Package → Interior Rescue & Gloss Wash → Deep Interior Detail → Ceramic Coating → Paint Correction → Mobile Tire Swap.
3. ✅ **Descriptions:** expanded package inclusion bullets. Royal includes full interior, full exterior, clay, wax, premium products and a 1-week guarantee. Removed polishing from its booking, home-page and services-page descriptions.
4. ✅ **Paint Correction:** removed booking price; “Request a quote” opens a dedicated form with vehicle type, year, make, model, colour, paint concerns, notes, location/address, preferred date/time, name, phone and email. No add-ons or Royal Club steps.
5. ✅ **Ceramic Coating:** $329 regular / $299 Royal Club. Sedan/coupe +$0; SUVs +$59; trucks/vans +$99; boats starting at +$599, depending on size.
6. ✅ **Add-ons:** fabric seat ceramic $39/seat, carpet ceramic $39/carpet and leather ceramic $49/seat, each with its own counter and requested benefits. Sedan/coupe counters cap at four each. Added Unfog windows $59. Rain-repellent is $89 for all windows, including both windshields, lasting 3–5 years.
7. ✅ **Times:** slots every 2.5 hours, three cars per slot with server capacity enforcement, plus a custom-time request option. Weekday 8 AM start is an assumption; weekends retain 10:30 AM opening.
8. ✅ ⚠️ **Royal Club payment:** added hosted Stripe checkout for the $16.95 annual charge. Discounts require server-verified payment and active subscription. **Stripe credentials and a deployed payment test are still required.**
9. ✅ **Multi-car discount:** added the “Want to add another car? Save $20 on each car ($40 off both)” prompt before confirmation. Each car gets its own package, size, make/model and add-ons. Review and confirmation itemize $20 off every car.
10. ✅ ⚠️ **Real submissions:** removed demo mode and added persistent booking/quote APIs, owner email delivery, server validation, retry protection and email sign-in. Recipient: `almasrirame444@gmail.com`. **Netlify deployment, Resend credentials and a verified sender are still required before messages can reach the owner.**

Validation: nine automated server/rules tests passed, including payment gating, email failure/retry and concurrent capacity. Desktop/mobile browser checks passed using simulated external responses. No live charge or email was made. See `BOOKING-INTEGRATION.md` for activation instructions.
