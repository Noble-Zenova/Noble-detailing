"use strict";

const config = window.NOBLE_CONFIG;
const booking = document.querySelector("#booking");
const header = document.querySelector("#header-actions");
const stepNames = [
    "Package",
    "Vehicle",
    "Location",
    "Date & time",
    "Your details",
    "Royal Club",
    "Add-ons",
    "Confirm",
];
const { packages, vehicles, extras, sizeFee, extraMax, slotCapacity } = window.NOBLE_CATALOG;
const shop = "138 Wescar Lane, Unit 2, Kanata";
const directions =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(shop);
const paymentNote = "No card needed. Pay after your detail.";
const policy =
    "Cancel or reschedule at least 24 hours before. Same-day cancellation or no-show: $50.";
const benefits = [
    "$30 off every detailing package",
    "$20 off tire swaps",
    "Priority evening & weekend booking",
    "No mobile fee on 2+ cars",
    "Free air freshener every visit",
];
const newCar = () => ({ packageId: 2, vehicleType: 0, model: "", addons: {} });
const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
}).format(new Date());
const state = {
    step: 1,
    car: 0,
    cars: [newCar()],
    location: "mobile",
    address: {},
    contact: {},
    month: today.slice(0, 7),
    slots: {},
    date: "",
    slot: null,
    membership: false,
    signedIn: false,
    agreed: false,
    screen: "",
    error: "",
    busy: false,
    bookingKey: newKey(),
    bookingSignature: "",
};

function newKey() {
    return (
        globalThis.crypto?.randomUUID?.() ??
        Date.now() + "-" + Math.random().toString(36).slice(2)
    );
}
function esc(value = "") {
    return String(value).replace(
        /[&<>"']/g,
        (char) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[char],
    );
}
function url(value, fallback = "") {
    if (!value) return fallback;
    try {
        const parsed = new URL(value, document.baseURI);
        if (["http:", "https:"].includes(parsed.protocol)) return parsed.href;
    } catch {}
    return fallback;
}
const money = (value) => "$" + value;
const car = () => state.cars[state.car];
const tire = (item) => item.packageId === 5;
const savings = () =>
    state.cars.reduce(
        (sum, item) =>
            sum + packages[item.packageId][2] - packages[item.packageId][3],
        0,
    );
const mustMobile = () => state.cars.some(tire);
const serviceAddress = () =>
    state.location === "shop"
        ? shop
        : [
              state.address.street,
              state.address.unit,
              state.address.city,
              state.address.postal,
          ]
              .filter(Boolean)
              .join(", ");
const prettyDate = (date, long = false) =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: "UTC",
        weekday: long ? "long" : "short",
        month: long ? "long" : "short",
        day: "numeric",
    }).format(new Date(date + "T12:00:00Z"));
const appointment = () => prettyDate(state.date) + " · " + state.slot.label;
const btn = (label, action, gold = false, value = "") =>
    `<button class="btn${gold ? " gold" : ""}" type="button" data-action="${action}" data-value="${esc(value)}">${esc(label)}</button>`;
const link = (label, href, target = "") =>
    `<a class="btn" href="${esc(url(href, "#"))}"${target ? ` target="${esc(target)}"` : ""}>${esc(label)}</a>`;
const ticks = (values) =>
    `<ul class="ticks">${values.map((value) => `<li>${esc(value)}</li>`).join("")}</ul>`;
const field = (label, name, value = "", placeholder = "", options = "") =>
    `<label class="field">${label}<input name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${options}></label>`;
const choice = (
    name,
    value,
    selected,
    title,
    subtitle,
    cost,
    disabled = false,
) =>
    `<label class="choice"><input type="radio" name="${name}" value="${value}" ${selected ? "checked" : ""} ${disabled ? "disabled" : ""}>
    <span><strong>${esc(title)}</strong><small class="muted">${esc(subtitle)}</small><small class="gold-text">${esc(cost)}</small></span></label>`;
const title = (heading, sub) =>
    `<h1 tabindex="-1">${heading}</h1><p class="muted">${sub}</p>`;

function progress(compact = false) {
    return `<ol class="progress ${compact ? "compact" : ""}" aria-label="Booking progress">${stepNames
        .map(
            (name, i) =>
                `<li class="${i < state.step ? "on" : ""}" ${i + 1 === state.step ? 'aria-current="step"' : ""} aria-label="${esc(name)}">
      ${compact ? "" : `<span data-number="0${i + 1}">0${i + 1} &nbsp;${esc(name)}</span>`}</li>`,
        )
        .join("")}</ol>`;
}
function packagePage() {
    const cards = [2, 1, 0, 3, 4, 5]
        .map((id) => {
            const [name, description, regular, member, features] = packages[id];
            const selected = id === car().packageId;
            return `<article class="card ${selected ? "selected" : ""}" data-action="package" data-value="${id}">
      ${id === 2 ? '<span class="tag">MOST POPULAR</span>' : ""}
      <h2>${esc(name)}</h2><p class="muted">${esc(description)}</p>
      ${
          id === 4
              ? '<p class="gold-text">Personalised quote</p>'
              : `<dl class="prices">${state.membership ? "" : `<div><dt>REGULAR</dt><dd>${money(regular)}</dd></div>`}
        <div class="gold-text"><dt>ROYAL CLUB</dt><dd>${money(member)}</dd></div></dl>
      <p class="muted">CAD · before HST</p>`
      }<details open><summary>What’s included</summary>${ticks(features)}</details>
      <button class="btn" type="button" data-action="package" data-value="${id}" aria-pressed="${selected}">${id === 4 ? "Request a quote" : "Book now →"}</button>
    </article>`;
        })
        .join("");
    return `<div class="wide"><div class="intro">
    <div><p class="eyebrow">BOOK YOUR DETAIL · STEP 1 OF 8${state.car ? " · VEHICLE " + (state.car + 1) : ""}</p>
      <h1 tabindex="-1">${state.membership ? "Your Royal Club prices." : "A cleaner car. A few taps away."}</h1>
      <p class="subtitle">Mobile or in-shop · Kanata &amp; Ottawa</p></div>
    <aside class="gold-card"><img src="assets/crown-teaser.svg" alt=""><h2>$15/year. Save $30 on every detail.</h2>
      <p class="muted">${state.membership ? "Royal Club active · Your savings apply automatically." : "Already a member? Log in for your price."}</p></aside>
    </div>${progress()}${config.demo ? '<p class="notice">Demo mode · Sample availability. No booking, payment, or message will be sent.</p>' : ""}
    <div class="cards">${cards}</div>
    <p id="status" role="status" class="notice error">${esc(state.error)}</p><div class="wide-footer"><div><p>${paymentNote}</p><p class="muted">Kid-safe, low-scent products · Rain or shine · Prices in CAD, before HST</p></div>
      </div>
    ${state.car ? btn("← Back to booking", "abort-car") : ""}
    </div>`;
}
function promise() {
    const atShop =
        state.step === 3 && state.location === "shop" && !state.screen;
    return `<aside class="promise"><p class="eyebrow">THE NOBLE STANDARD</p>
    <h2>${atShop ? "A premium detail.<br>At our Kanata shop." : "Premium care.<br>On your terms."}</h2>
    <p class="description">${atShop ? shop : "At your driveway or our Kanata shop.<br>A fresh start for every journey."}</p><hr>
    <strong>No card needed to book.</strong><p class="muted">Choose your service. Pick a time.<br>Pay after your detail.</p>
    <div class="box">${ticks(["Kid-safe, low-scent products", "Rain or shine", shop])}</div></aside>`;
}
function footer(label = "Continue →") {
    return `<div class="panel-footer"><hr><p class="muted">${paymentNote}</p><button class="btn gold" type="submit">${label}</button></div>`;
}
function panel(body, foot = "", withProgress = true) {
    return `<div class="split">${promise()}<section class="panel"><form id="step-form">
    <div class="panel-content">${
        withProgress
            ? `<div class="step-meta">
      <button class="link" type="button" data-action="back" aria-label="Previous step">←</button><p class="eyebrow">STEP ${state.step} OF 8</p>
      </div>${progress(true)}`
            : ""
    }${body}<p id="status" role="status" class="notice error">${esc(state.error)}</p></div>${foot}</form></section></div>`;
}
function vehiclePage() {
    return panel(
        title("What do you drive?", "Choose your vehicle size.") +
            vehicles
                .map(([name, desc], i) =>
                    i === 5 && car().packageId !== 3
                        ? ""
                        : choice(
                              "vehicleType",
                              i,
                              car().vehicleType === i,
                              name,
                              desc,
                              sizeFee({ ...car(), vehicleType: i })
                                  ? "+" +
                                        money(
                                            sizeFee({
                                                ...car(),
                                                vehicleType: i,
                                            }),
                                        ) +
                                        (i === 5 ? " starting price" : "")
                                  : "Included",
                          ),
                )
                .join("") +
            field(
                "Make &amp; model",
                "model",
                car().model,
                "e.g. Toyota RAV4",
                'required maxlength="100"',
            ) +
            '<p class="muted">Size extras apply to detailing packages.</p>',
        footer(),
    );
}
function locationPage() {
    const mobile = state.location === "mobile";
    const locationOptions =
        choice(
            "location",
            "mobile",
            mobile,
            "We come to you",
            "At your home or workplace",
            "+$29 mobile fee",
        ) +
        choice(
            "location",
            "shop",
            !mobile,
            "Come to our shop",
            shop,
            mustMobile()
                ? "Mobile Tire Swap requires mobile service"
                : "Free · no mobile fee",
            mustMobile(),
        );
    if (!mobile)
        return panel(
            title("See you at the shop.", "A premium detail. No mobile fee.") +
                locationOptions +
                `<div class="box stack"><p class="muted">KANATA</p><h2>138 Wescar Lane</h2><p>Unit 2</p>
      <p class="muted">3 min from Tanger Outlets<br>8 min from Canadian Tire Centre</p>${link("Get directions ↗", directions)}</div>
      <p class="muted">Standard arrivals daily · 9:30 AM–6:00 PM</p>`,
            footer(),
        );
    const a = state.address;
    return panel(
        title("Your place or ours?", "Mobile selected. Where should we come?") +
            locationOptions +
            field(
                "Service address *",
                "street",
                a.street,
                "Enter your street address",
                'required autocomplete="address-line1" maxlength="150"',
            ) +
            field(
                "Apartment / unit (optional)",
                "unit",
                a.unit,
                "Apartment, suite or unit",
                'autocomplete="address-line2" maxlength="50"',
            ) +
            `<div class="two">${field("City *", "city", a.city, "Ottawa", 'required autocomplete="address-level2" maxlength="80"')}
      ${field("Postal code *", "postal", a.postal, "K2V 0A1", 'required autocomplete="postal-code" maxlength="7" pattern="[A-Za-z][0-9][A-Za-z] ?[0-9][A-Za-z][0-9]"')}</div>
      <div class="box stack"><strong>How many cars?</strong><div class="count">
        <button type="button" data-action="remove-car" aria-label="Remove last vehicle" ${state.cars.length < 2 ? "disabled" : ""}>−</button>
        <span>${state.cars.length} ${state.cars.length === 1 ? "car" : "cars"}</span><button type="button" data-action="add-car" aria-label="Add vehicle" ${state.cars.length >= slotCapacity ? "disabled" : ""}>+</button></div>
        <p class="muted">Book 2+ cars at one address and the $29 mobile fee is waived.</p>
        ${state.cars.length > 1 ? state.cars.map((item, i) => `<button class="link" type="button" data-action="edit-car" data-value="${i}">Edit vehicle ${i + 1} · ${esc(item.model || packages[item.packageId][0])}</button>`).join("") : ""}
        ${state.cars.length < slotCapacity ? btn("+ Add another vehicle", "add-car") : `<p class="muted">Maximum ${slotCapacity} cars per appointment.</p>`}</div>
      <p class="muted">Please make space in the driveway and remove valuables.</p>`,
        footer(),
    );
}
function calendarPage() {
    const first = new Date(state.month + "-01T12:00:00Z");
    const offset = (first.getUTCDay() + 6) % 7;
    const days = new Date(
        Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const cells = Array(offset).fill('<span aria-hidden="true"></span>');
    for (let day = 1; day <= days; day++) {
        const date = state.month + "-" + String(day).padStart(2, "0");
        cells.push(
            `<button type="button" data-action="date" data-value="${date}" aria-label="${prettyDate(date, true)}" aria-pressed="${date === state.date}" ${!Object.hasOwn(state.slots, date) ? "disabled" : ""}>${day}</button>`,
        );
    }
    const slots = state.slots[state.date] ?? [];
    return panel(
        title(
            "Make time for a reset.",
            "Choose an available date and arrival time.",
        ) +
            `<div class="box"><div class="month"><button type="button" data-action="month" data-value="-1" aria-label="Previous month" ${state.month <= today.slice(0, 7) ? "disabled" : ""}>‹</button>
      <strong>${new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", month: "long", year: "numeric" }).format(first)}</strong>
      <button type="button" data-action="month" data-value="1" aria-label="Next month">›</button></div>
      <div class="calendar">${[..."MTWTFSS"].map((c) => `<span class="muted">${c}</span>`).join("")}${cells.join("")}</div></div>
      ${state.busy ? '<p class="muted" role="status">Checking availability…</p>' : ""}
      ${!state.busy && !Object.values(state.slots).some((list) => list.length) ? '<p class="muted">No standard slots available. Select a date to request a custom time.</p>' : ""}
      ${
          state.date
              ? `<strong>${prettyDate(state.date, true)}</strong><div class="two">${slots
                    .map(
                        (slot, i) =>
                            `<button class="btn" type="button" data-action="slot" data-value="${i}" aria-pressed="${slot.id === state.slot?.id}">${esc(slot.label)}</button>`,
                    )
                    .join("")}</div>`
              : ""
      }
      ${state.date ? `<label class="field">Or request a custom arrival time<input type="time" name="customTime" min="08:00" max="21:59" value="${state.slot?.custom ? esc(state.slot.time) : ""}"></label><p class="muted">Custom times are requests and require confirmation from our team.</p>` : ""}
      <p class="muted">${config.demo ? "Sample availability for this demo." : "Only available slots appear."} All times are local.<br>Standard arrivals daily · 9:30 AM–6:00 PM</p>`,
        footer(),
    );
}
function detailsPage() {
    const c = state.contact;
    return panel(
        title("A few final details.", "No account needed to book.") +
            field(
                "Full name",
                "fullName",
                c.fullName,
                "Your full name",
                'required autocomplete="name" maxlength="100"',
            ) +
            field(
                "Phone number",
                "phone",
                c.phone,
                "(613) 000-0000",
                'type="tel" required autocomplete="tel" maxlength="30"',
            ) +
            field(
                "Email address",
                "email",
                c.email,
                "you@example.com",
                'type="email" required autocomplete="email" maxlength="254"',
            ) +
            `<label class="field">Anything we should know? (optional)<textarea name="notes" maxlength="1000" placeholder="Access instructions, areas of concern…">${esc(c.notes)}</textarea></label>
      <p class="muted">We’ll use these details to contact you about your booking.</p>`,
        footer(),
    );
}
function clubPage() {
    return panel(
        title(
            "Your car deserves<br>the royal treatment.",
            "An optional membership. Real savings.",
        ) +
            `<div class="gold-card"><img src="assets/crown-club.svg" alt=""><h2>Save ${money(savings())} on this booking</h2>
      <strong class="gold-text">$15 / year + HST</strong>${ticks(benefits)}<hr>
      <p class="muted">Join today for $16.95 including HST.<br>Renews yearly. Cancel anytime.</p></div>
      ${btn("Join and save " + money(savings()), "join", true)}${btn("No thanks, continue", "skip-club")}
      <p class="muted">Service payment is still due after your detail.</p>`,
    );
}
function paymentPage() {
    return panel(
        title(
            "Welcome to Royal Club.",
            "Your discount applies to this booking after membership is activated.",
        ) +
            `<div class="gold-card"><p class="eyebrow">ROYAL CLUB · ANNUAL</p><h2>$16.95 due today</h2><p class="muted">$15 membership + $1.95 HST</p></div>
      <p class="muted">By joining, you authorise $16.95 today and yearly renewals. Your service is still paid after the detail.</p>
      ${config.demo ? '<p class="notice">Demo payment. No card or wallet details are collected.</p>' : '<p class="muted">Card and supported wallets are handled by secure checkout.</p>'}
      ${btn(config.demo ? "Simulate Royal Club payment" : "Pay $16.95 & join Royal Club", "pay", true)}
      ${state.paymentStarted ? btn("Check membership payment", "verify-payment") : ""}
      ${btn("Back to Royal Club offer", "offer")}${btn("Continue as a guest", "skip-club")}`,
    );
}
function addOnsPage() {
    const cards = extras
        .map(([name, desc, price, max, popular], id) => {
            const count = car().addons[id] || 0;
            max = extraMax(car(), id);
            return `<div class="box addon">${popular ? '<span class="tag">POPULAR</span>' : ""}
      <label><input type="checkbox" name="addon" value="${id}" ${count ? "checked" : ""}>${esc(name)}</label>
      <p class="muted">${esc(desc)}</p><p class="gold-text">+${money(price)}${max > 1 ? " each" : ""}</p>
      ${
          max > 1
              ? `<div class="count">
        <button type="button" data-action="extra-minus" data-value="${id}" aria-label="Remove one ${esc(name)}" ${!count ? "disabled" : ""}>−</button><span aria-live="polite">${count}</span>
        <button type="button" data-action="extra-plus" data-value="${id}" aria-label="Add one ${esc(name)}" ${count >= max ? "disabled" : ""}>+</button></div>`
              : ""
      }</div>`;
        })
        .join("");
    return panel(
        title(
            "A little extra care?",
            "Add-ons for vehicle " +
                (state.car + 1) +
                " · " +
                esc(car().model) +
                ". Seat and carpet quantities are per vehicle.",
        ) +
            btn("Skip add-ons →", "skip-addons") +
            cards,
        footer(),
    );
}
function reviewPage() {
    const row = (name, value, step) =>
        `<div><dt>${name} &nbsp;·&nbsp; <button type="button" class="link" data-action="edit" data-value="${step}" aria-label="Edit ${name.toLowerCase()}">Edit</button></dt><dd>${value}</dd></div>`;
    const selected = state.cars.flatMap((item, index) =>
        Object.entries(item.addons)
            .filter(([, count]) => count > 0)
            .map(
                ([id, count]) =>
                    "Car " +
                    (index + 1) +
                    " · " +
                    extras[id][0] +
                    " × " +
                    count,
            ),
    );
    const estimate = demoPrice();
    return panel(
        title("One last look.", "Your detail is almost booked.") +
            `${state.membership ? '<div><span class="tag">ROYAL CLUB MEMBER</span></div>' : ""}
    <dl class="box summary">
      ${row("YOUR PACKAGE", state.cars.map((item) => esc(packages[item.packageId][0])).join("<br>"), 1)}
      ${row("VEHICLE", state.cars.map((item) => esc(item.model + " · " + vehicles[item.vehicleType][0])).join("<br>"), 2)}
      ${row("LOCATION", esc(state.location === "mobile" ? "Mobile · " + state.cars.length + (state.cars.length === 1 ? " car" : " cars") : "Shop · Kanata") + "<br>" + esc(serviceAddress()), 3)}
      ${row("WHEN", esc(appointment()), 4)}
      ${row("YOUR DETAILS", esc(state.contact.fullName + " · " + state.contact.email), 5)}
      ${row("ADD-ONS", selected.map(esc).join("<br>") || "None selected", 7)}
    </dl><div class="gold-card"><h2>Service total: ${money(estimate.total)} + HST</h2><dl class="total-lines">${estimate.lines.map(([label, amount]) => `<div><dt>${esc(label)}</dt><dd>${amount < 0 ? "−" : ""}${money(Math.abs(amount))}</dd></div>`).join("")}</dl>${state.cars.some((item) => item.vehicleType === 5) ? "<p>Boat pricing is a starting estimate and depends on size.</p>" : ""}</div>${state.cars.length < slotCapacity ? `<div class="box stack"><strong>Want to add another car? Save $20 on each car ($40 off both)</strong>${btn("Yes, add another car", "review-add-car")}<p class="muted">Choose a package, vehicle and add-ons for each car. Same appointment and location.</p></div>` : `<p class="muted">Maximum ${slotCapacity} cars per appointment.</p>`}<p class="muted">Pay for the service after the job. Membership is paid separately.</p>
    <label class="choice"><input type="checkbox" name="agreed" required ${state.agreed ? "checked" : ""}>
      <span><strong>I agree to the cancellation policy</strong><small class="muted">${policy}</small></span></label>`,
        footer(config.demo ? "Confirm demo booking →" : "Confirm booking →"),
    );
}
function demoPrice() {
    return window.NOBLE_CATALOG.price(
        state.cars,
        state.location,
        state.membership,
    );
}
function confirmedPage() {
    const r = state.receipt;
    const manage = url(r.manageUrl || config.accountUrl);
    return panel(
        title(
            config.demo
                ? "Demo booking complete."
                : r.pending
                  ? "Your time request was sent."
                  : "You’re booked.",
            config.demo
                ? "This was a preview of the confirmation screen."
                : "We’ll take it from here.",
        ) +
            `<div><span class="tag">✓ ${config.demo ? "DEMO ONLY" : r.pending ? "CUSTOM TIME REQUESTED" : "BOOKING CONFIRMED"}</span></div>
    ${state.membership ? '<div><span class="tag">ROYAL CLUB MEMBER</span></div>' : ""}
    <div class="gold-card"><p class="eyebrow">YOUR TOTAL</p><p class="total">${money(r.total)} + HST</p>${state.cars.some((item) => item.vehicleType === 5) ? "<p>Starting estimate; boat price depends on size.</p>" : ""}
      <p>Pay after the job.</p><hr><dl class="total-lines">${r.lines
          .map(
              ([label, amount]) =>
                  `<div><dt>${esc(label)}</dt><dd>${amount < 0 ? "−" : ""}${money(Math.abs(amount))}</dd></div>`,
          )
          .join("")}</dl></div>
    <h2>${esc(appointment())}</h2>
    <p>${r.pending ? "Requested service location:" : state.location === "mobile" ? "We’re coming to you at:" : "Your Kanata shop appointment:"}<br>${esc(serviceAddress())}</p>
    ${state.location === "mobile" ? '<p class="muted">Please make space in the driveway and remove valuables.</p>' : link("Get directions ↗", directions)}
    <p class="muted">${config.demo ? "No appointment was reserved and no email or text was sent." : "Your booking reference is " + esc(r.reference) + "."}</p>
    ${url(r.calendarUrl) ? link("Add to calendar", r.calendarUrl) : config.demo ? btn("Add sample to calendar", "calendar", true) : ""}
    ${manage ? link("Reschedule or cancel", manage) : ""}
    <p class="muted">${policy}</p>
    ${config.demo ? btn("Start a new demo booking", "restart") : config.accountUrl ? link("View my account", config.accountUrl) : ""}`,
        "",
        false,
    );
}
function loginPage() {
    return panel(
        title(
            "Your next detail,<br>even easier.",
            "Sign in to apply your Royal Club benefits.",
        ) +
            `${config.googleSignInUrl && !config.demo ? link("Continue with Google", config.googleSignInUrl) + '<p class="muted">or use a one-time email code</p>' : ""}
      ${field("Email address", "loginEmail", state.loginEmail, "you@example.com", 'type="email" required autocomplete="email"')}
      ${state.codeSent ? field("One-time code", "code", state.code, "Enter your code", 'required inputmode="numeric" autocomplete="one-time-code"') : ""}
      <button class="btn gold" type="submit">${state.codeSent ? "Verify sign-in code" : "Send sign-in code"}</button>
      <p class="muted">${config.demo ? "Preview only. Use code 123456 to test active member pricing." : "No password needed. We’ll email a secure code."}</p>${btn("Back to booking", "close-login")}`,
        "",
        false,
    );
}
function render(focus = false) {
    const start = state.step === 1 && !state.screen;
    header.innerHTML = start
        ? `<a class="link muted home" href="${esc(url(config.websiteUrl, "/"))}">← Back to website</a>${state.signedIn && config.accountUrl ? link("My account", config.accountUrl) : btn(state.membership ? "Royal Club active" : "Member log in", "login")}`
        : `<span class="muted region">Kanata &amp; Ottawa</span>${config.helpUrl ? link("Need help?", config.helpUrl, "_top") : btn("Need help?", "help")}`;
    const pages = [
        null,
        packagePage,
        vehiclePage,
        locationPage,
        calendarPage,
        detailsPage,
        clubPage,
        addOnsPage,
        reviewPage,
        confirmedPage,
    ];
    booking.innerHTML =
        state.screen === "quote"
            ? quotePage()
            : state.screen === "quote-done"
              ? quoteDonePage()
              : state.screen === "login"
                ? loginPage()
                : state.screen === "payment"
                  ? paymentPage()
                  : pages[state.step]();
    if (state.busy)
        booking.querySelectorAll("button, input, textarea").forEach((el) => {
            el.disabled = true;
        });
    if (focus) {
        window.scrollTo(0, 0);
        booking.querySelector("h1")?.focus({ preventScroll: true });
    }
}

async function api(path, body) {
    const root = config.apiBase.replace(/\/$/, "");
    const response = await fetch(root + path, {
        method: body === undefined ? "GET" : "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers:
            body === undefined
                ? { Accept: "application/json" }
                : {
                      Accept: "application/json",
                      "Content-Type": "application/json",
                  },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(40000),
    });
    if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw Object.assign(new Error(failure.error || "Request failed"), {
            status: response.status,
        });
    }
    return response.json();
}
function bookingOptions() {
    return {
        vehicles: state.cars.map((item) => ({
            ...item,
            model: item.model.trim(),
        })),
        location: state.location,
        address: state.location === "mobile" ? state.address : null,
    };
}
function sampleSlots(month) {
    const slots = {};
    for (let i = 1; i <= 31; i++) {
        const day = month + "-" + String(i).padStart(2, "0");
        const date = new Date(day + "T12:00:00Z");
        if (
            !Number.isFinite(+date) ||
            date.toISOString().slice(0, 10) !== day ||
            day < today
        )
            continue;
        slots[day] = window.NOBLE_CATALOG.slots(day);
    }
    return slots;
}
async function loadSlots(focus = false) {
    state.slots = {};
    state.error = "";
    state.busy = true;
    render(focus);
    try {
        const result = config.demo
            ? sampleSlots(state.month)
            : (
                  await api("/availability", {
                      month: state.month,
                      ...bookingOptions(),
                  })
              ).dates;
        if (!result || typeof result !== "object")
            throw new Error("Invalid availability");
        state.slots = Object.fromEntries(
            Object.entries(result)
                .filter(
                    ([date, slots]) =>
                        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
                        date.startsWith(state.month + "-") &&
                        date >= today &&
                        Array.isArray(slots),
                )
                .map(([date, slots]) => [
                    date,
                    slots.filter(
                        (slot) =>
                            typeof slot?.id === "string" &&
                            typeof slot?.label === "string",
                    ),
                ]),
        );
    } catch {
        state.error =
            "We couldn’t check availability. Try another month or go back and try again.";
    } finally {
        state.slot =
            state.slots[state.date]?.find(
                (slot) => slot.id === state.slot?.id,
            ) ?? null;
        if (!Object.hasOwn(state.slots, state.date)) state.date = "";
        state.busy = false;
        render(focus);
    }
}
function go(step) {
    state.screen = "";
    state.step = step;
    state.error = "";
    if (step === 4) return loadSlots(true);
    render(true);
}
function error(message) {
    state.error = message;
    const status = document.querySelector("#status");
    if (status) status.textContent = message;
}
async function withRequest(task, message) {
    state.busy = true;
    state.error = "";
    const form = document.querySelector("#step-form");
    form?.setAttribute("aria-busy", "true");
    const controls = [
        ...(form?.querySelectorAll(
            "button:not(:disabled), input:not(:disabled), textarea:not(:disabled)",
        ) ?? []),
    ];
    controls.forEach((el) => {
        el.disabled = true;
    });
    try {
        await task();
    } catch (cause) {
        error(typeof message === "function" ? message(cause) : message);
    } finally {
        state.busy = false;
        if (form === document.querySelector("#step-form")) {
            form?.removeAttribute("aria-busy");
            controls.forEach((el) => {
                el.disabled = false;
            });
        } else {
            render(true);
        }
    }
}
function setMembership(result) {
    state.signedIn = result.signedIn === true;
    state.membership = state.signedIn && result.membershipActive === true;
}
function returnToOffer(screen = "") {
    state.screen = screen;
    state.error = "";
    render(true);
}
function setExtra(id, count) {
    car().addons[id] = Math.max(0, Math.min(extraMax(car(), id), count));
}
function invalidateSlot() {
    state.date = "";
    state.slot = null;
    state.agreed = false;
}
function saveField(target) {
    const { name, value } = target;
    if (state.screen === "quote") {
        state.quote[name] = value;
        return;
    }
    if (name === "customTime") {
        if (value)
            state.slot = {
                id: "custom",
                label: value + " (requested)",
                time: value,
                custom: true,
            };
        else state.slot = null;
    }
    if (name === "model") car().model = value;
    if (["street", "unit", "city", "postal"].includes(name)) {
        if (state.address[name] !== value) invalidateSlot();
        state.address[name] = value;
    }
    if (["fullName", "phone", "email", "notes"].includes(name))
        state.contact[name] = value;
    if (name === "loginEmail" || name === "code") state[name] = value;
}
booking.addEventListener("input", (event) => saveField(event.target));
booking.addEventListener("change", (event) => {
    if (state.screen === "quote") {
        saveField(event.target);
        return;
    }
    const { name, value, checked } = event.target;
    if (name === "vehicleType") {
        car().vehicleType = Number(value);
        for (const id of Object.keys(car().addons))
            setExtra(Number(id), car().addons[id]);
        if (!state.returnToReview) invalidateSlot();
        render();
    }
    if (name === "location") {
        state.location = value;
        invalidateSlot();
        render(true);
    }
    if (name === "agreed") state.agreed = checked;
    if (name === "addon") {
        setExtra(Number(value), checked ? car().addons[value] || 1 : 0);
        render();
        booking
            .querySelector('input[name="addon"][value="' + value + '"]')
            ?.focus({ preventScroll: true });
    }
});
async function submitBooking() {
    if (!state.slot) return go(4);
    const payload = {
        ...bookingOptions(),
        date: state.date,
        slotId: state.slot.id,
        contact: state.contact,
        customTime: state.slot.custom ? state.slot.time : null,
        cancellationAccepted: state.agreed,
    };
    const signature = JSON.stringify(payload);
    if (state.bookingSignature !== signature) {
        state.bookingSignature = signature;
        state.bookingKey = newKey();
    }
    payload.idempotencyKey = state.bookingKey;
    await withRequest(
        async () => {
            const receipt = config.demo
                ? demoPrice()
                : await api("/bookings", payload);
            if (
                (!config.demo && !receipt.reference) ||
                !Number.isFinite(receipt.total) ||
                !Array.isArray(receipt.lines)
            )
                throw new Error("Invalid receipt");
            state.receipt = receipt;
            if (!config.demo)
                state.membership = receipt.membershipActive === true;
            go(9);
        },
        (cause) => {
            if (cause.status === 409) {
                invalidateSlot();
                return "That appointment is no longer available. Go back to Date & time and choose another slot.";
            }
            return (
                cause.message ||
                "We couldn’t confirm the booking. Please try again."
            );
        },
    );
}
async function login() {
    await withRequest(async () => {
        if (!state.codeSent) {
            if (!config.demo)
                await api("/session/code", { email: state.loginEmail });
            state.codeSent = true;
            render(true);
            return;
        }
        const result = config.demo
            ? {
                  signedIn: state.code.trim() === "123456",
                  membershipActive: state.code.trim() === "123456",
              }
            : await api("/session/verify", {
                  email: state.loginEmail,
                  code: state.code,
              });
        if (result.signedIn !== true) throw new Error("Invalid code");
        setMembership(result);
        state.code = "";
        state.codeSent = false;
        state.screen = "";
        go(state.step);
    }, "Sign-in could not be completed. Check your details or return to booking.");
}
booking.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.busy) return;
    if (state.screen === "login") return login();
    if (state.screen === "quote") return submitQuote();
    if (state.step === 2) {
        if (!car().model.trim())
            return error("Enter your vehicle make and model.");
        if (state.needsLocation) {
            state.needsLocation = false;
            state.returnToReview = false;
            invalidateSlot();
            return go(3);
        }
        if (state.returnToReview) return go(7);
        if (state.car) {
            state.car = 0;
            state.pendingCar = false;
            return go(3);
        }
        return go(3);
    }
    if (
        state.step === 3 &&
        state.location === "mobile" &&
        (!state.address.street?.trim() || !state.address.city?.trim())
    )
        return error("Enter a street address and city.");
    if (state.step === 4 && !state.slot)
        return error("Choose an available date and time.");
    if (state.step === 5) {
        if (
            !state.contact.fullName?.trim() ||
            !/^[+\d()\s.-]+$/.test(state.contact.phone || "") ||
            (state.contact.phone || "").replace(/\D/g, "").length < 10
        ) {
            return error("Enter a valid name and phone number.");
        }
        return go(state.membership ? 7 : 6);
    }
    if (state.step === 7) return finishAddons();
    if (state.step === 8) return submitBooking();
    go(state.step + 1);
});
async function openPayment() {
    if (config.demo) {
        setMembership({ signedIn: true, membershipActive: true });
        return go(7);
    }
    const checkout = window.open("about:blank", "_blank");
    if (!checkout) return error("Allow pop-ups to open secure checkout.");
    checkout.opener = null;
    await withRequest(async () => {
        try {
            const result = await api("/membership/checkout", {
                email: state.contact.email,
            });
            const checkoutUrl = url(result.checkoutUrl);
            if (!checkoutUrl || !checkoutUrl.startsWith("https://"))
                throw new Error("Invalid checkout URL");
            checkout.location.replace(checkoutUrl);
            state.paymentStarted = true;
            render();
        } catch (cause) {
            checkout.close();
            throw cause;
        }
    }, "Secure checkout couldn’t be opened. Please try again or continue as a guest.");
}
async function verifyPayment() {
    await withRequest(async () => {
        const result = await api("/session");
        setMembership(result);
        if (!state.membership) throw new Error("Membership not active");
        go(7);
    }, "Membership is not active yet. Finish checkout and try again, or continue as a guest.");
}
function downloadCalendar() {
    const eventDate = state.date.replaceAll("-", "") + "T" + state.slot.time;
    const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, "");
    const contents = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Noble//Booking Demo//EN",
        "BEGIN:VEVENT",
        "UID:" + newKey() + "@noble-demo",
        "DTSTAMP:" + stamp,
        "DTSTART;TZID=America/Toronto:" + eventDate,
        "SUMMARY:Noble detailing sample appointment",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
    ].join("\r\n");
    const objectUrl = URL.createObjectURL(
        new Blob([contents], { type: "text/calendar" }),
    );
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "noble-demo.ics";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
function replaceControlFocus(action, value) {
    [...booking.querySelectorAll("[data-action]")]
        .find(
            (el) =>
                el.dataset.action === action &&
                el.dataset.value === value &&
                !el.disabled,
        )
        ?.focus({ preventScroll: true });
}
document.addEventListener("click", async (event) => {
    const control = event.target.closest("[data-action]");
    if (!control || state.busy || event.target.closest("summary, details ul"))
        return;
    const { action, value } = control.dataset;
    const id = Number(value);
    switch (action) {
        case "package":
            if (car().packageId !== id && !state.returnToReview)
                invalidateSlot();
            car().packageId = id;
            if (mustMobile()) {
                if (state.returnToReview && state.location === "shop")
                    state.needsLocation = true;
                state.location = "mobile";
            }
            if (id === 4) {
                state.screen = "quote";
                state.quote = {};
                state.quoteKey = "";
                state.quoteSignature = "";
                return render(true);
            }
            if (car().vehicleType === 5 && id !== 3) car().vehicleType = 0;
            return go(2);
        case "next":
            return go(2);
        case "close-quote":
            state.screen = "";
            return go(1);
        case "back":
            if (state.step === 8) {
                state.car = 0;
                return go(7);
            }
            if (state.screen === "payment") return returnToOffer();
            return go(
                state.step === 7 && state.membership ? 5 : state.step - 1,
            );
        case "edit":
            state.car = 0;
            return go(id);
        case "review-add-car":
            state.returnToReview = true;
        case "add-car":
            if (state.cars.length >= slotCapacity) {
                state.returnToReview = false;
                return error(`An appointment can take up to ${slotCapacity} vehicles.`);
            }
            state.car = state.cars.push(newCar()) - 1;
            state.pendingCar = true;
            if (!state.returnToReview) invalidateSlot();
            return go(1);
        case "edit-car":
            state.car = id;
            return go(1);
        case "abort-car":
            if (state.pendingCar) state.cars.pop();
            state.pendingCar = false;
            state.car = 0;
            const backToReview = state.returnToReview;
            state.returnToReview = false;
            return go(backToReview ? 8 : 3);
        case "remove-car":
            if (state.cars.length > 1) state.cars.pop();
            invalidateSlot();
            return render();
        case "month": {
            const month = new Date(state.month + "-01T12:00:00Z");
            month.setUTCMonth(month.getUTCMonth() + id);
            state.month = month.toISOString().slice(0, 7);
            invalidateSlot();
            await loadSlots();
            return replaceControlFocus(action, value);
        }
        case "date":
            state.date = value;
            state.slot = null;
            render();
            return replaceControlFocus(action, value);
        case "slot":
            state.slot = state.slots[state.date][id];
            state.error = "";
            render();
            return replaceControlFocus(action, value);
        case "login":
            return returnToOffer("login");
        case "close-login":
            return returnToOffer();
        case "join":
            return returnToOffer("payment");
        case "offer":
            return returnToOffer();
        case "pay":
            return openPayment();
        case "verify-payment":
            return verifyPayment();
        case "skip-club":
            state.car = 0;
            return go(7);
        case "skip-addons":
            car().addons = {};
            return finishAddons();
        case "extra-plus":
        case "extra-minus":
            setExtra(
                id,
                (car().addons[id] || 0) + (action === "extra-plus" ? 1 : -1),
            );
            render();
            return replaceControlFocus(action, value);
        case "calendar":
            return downloadCalendar();
        case "restart":
            return location.reload();
        case "help": {
            const dialog = document.createElement("dialog");
            dialog.className = "dialog";
            dialog.innerHTML = `<form method="dialog" class="stack"><h2>Need help?</h2><p>Our shop is at ${shop}.</p>
        ${link("Get directions ↗", directions)}<button class="btn gold">Back to booking</button></form>`;
            document.body.append(dialog);
            dialog.addEventListener("close", () => dialog.remove(), {
                once: true,
            });
            return dialog.showModal();
        }
    }
});
render();
if (!config.demo) {
    state.busy = true;
    booking.setAttribute("aria-busy", "true");
    render();
    api("/session")
        .then(setMembership)
        .catch(() => {})
        .finally(() => {
            state.busy = false;
            booking.removeAttribute("aria-busy");
            render();
        });
}

function finishAddons() {
    if (!state.returnToReview && state.car < state.cars.length - 1) {
        state.car++;
        return go(7);
    }
    state.car = 0;
    state.returnToReview = false;
    state.pendingCar = false;
    return go(8);
}
function quotePage() {
    const q = state.quote || {};
    return panel(
        title(
            "Request a paint correction quote.",
            "Tell us about your vehicle and paint. We will contact you with a personalised quote.",
        ) +
            field(
                "Vehicle type",
                "vehicleType",
                q.vehicleType,
                "Sedan, SUV, truck…",
                'required maxlength="80"',
            ) +
            field(
                "Year",
                "year",
                q.year,
                "2022",
                'required type="number" min="1900" max="2100"',
            ) +
            field("Make", "make", q.make, "Toyota", 'required maxlength="80"') +
            field(
                "Model",
                "model",
                q.model,
                "Camry",
                'required maxlength="80"',
            ) +
            field(
                "Paint colour",
                "colour",
                q.colour,
                "Black",
                'required maxlength="80"',
            ) +
            field(
                "What is wrong with the paint?",
                "condition",
                q.condition,
                "Swirls, scratches, fading…",
                'required maxlength="1000"',
            ) +
            `<label class="field">Notes (optional)<textarea name="notes" maxlength="2000">${esc(q.notes)}</textarea></label>
    <label class="field">Service location<select name="location" required><option value="shop" ${q.location !== "mobile" ? "selected" : ""}>At the shop · ${shop}</option><option value="mobile" ${q.location === "mobile" ? "selected" : ""}>Mobile · my address</option></select></label>` +
            field(
                "Address (required for mobile)",
                "address",
                q.address,
                "Street, city, postal code",
                'maxlength="300"',
            ) +
            field(
                "Preferred date",
                "date",
                q.date,
                "",
                `required type="date" min="${today}"`,
            ) +
            field(
                "Preferred time",
                "time",
                q.time,
                "",
                'required type="time"',
            ) +
            field(
                "Name",
                "fullName",
                q.fullName,
                "Full name",
                'required maxlength="100"',
            ) +
            field(
                "Phone",
                "phone",
                q.phone,
                "",
                'required type="tel" maxlength="30"',
            ) +
            field(
                "Email",
                "email",
                q.email,
                "",
                'required type="email" maxlength="254"',
            ) +
            '<p class="muted">Preferred dates and times are requests, subject to confirmation. No add-ons or membership purchase required.</p>' +
            btn("Back to packages", "close-quote"),
        footer("Send quote request →"),
        false,
    );
}
function quoteDonePage() {
    return panel(
        title(
            "Your quote request was sent.",
            "Our team will contact you about your paint correction quote.",
        ) +
            `<p>Reference: ${esc(state.quoteReference)}</p>` +
            btn("Back to packages", "close-quote"),
        "",
        false,
    );
}
async function submitQuote() {
    const form = document.querySelector("#step-form");
    state.quote = Object.fromEntries(new FormData(form));
    if (state.quote.location === "mobile" && !state.quote.address.trim())
        return error("Enter your mobile service address.");
    await withRequest(
        async () => {
            const signature = JSON.stringify(state.quote);
            if (signature !== state.quoteSignature) {
                state.quoteKey = newKey();
                state.quoteSignature = signature;
            }
            const result = await api("/quotes", {
                ...state.quote,
                idempotencyKey: state.quoteKey,
            });
            state.quoteReference = result.reference;
            state.screen = "quote-done";
            render(true);
        },
        (cause) =>
            cause.message ||
            "We could not send your quote request. Please try again.",
    );
}

window.addEventListener("noble-open-quote", () => {
    if (state.busy) return;
    state.screen = "quote";
    state.quote = {};
    state.quoteKey = "";
    state.quoteSignature = "";
    state.error = "";
    render(true);
});
