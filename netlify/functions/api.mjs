import { getStore } from "@netlify/blobs";
import {
    createHash,
    randomBytes,
    randomInt,
    timingSafeEqual,
} from "node:crypto";
import {
    booking,
    catalog,
    email,
    fail,
    pastSlot,
    quote,
    reserve,
    text,
    validDate,
} from "./lib/rules.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const store = (name) =>
    getStore({
        name: `noble-${process.env.CONTEXT || "production"}-${name}`,
        consistency: "strong",
    });
const json = (body, status = 200, headers = {}) =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            ...headers,
        },
    });
function required(name) {
    const value = process.env[name];
    if (!value || value.includes("replace_me"))
        fail(
            "Online booking setup is incomplete. Please call +1 (613) 879-9461.",
            503,
        );
    return value;
}
async function stripe(path, data, key) {
    const response = await fetch("https://api.stripe.com/v1" + path, {
        method: data ? "POST" : "GET",
        headers: {
            Authorization: "Bearer " + required("STRIPE_SECRET_KEY"),
            ...(key ? { "Idempotency-Key": key } : {}),
            ...(data
                ? { "Content-Type": "application/x-www-form-urlencoded" }
                : {}),
        },
        body: data ? new URLSearchParams(data) : undefined,
        signal: AbortSignal.timeout(12000),
    });
    if (!response.ok)
        fail(
            "Secure payment service is unavailable. Try again or continue as a guest.",
            503,
        );
    return response.json();
}
async function sendMail(subject, message, key, recipient, replyTo) {
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: "Bearer " + required("RESEND_API_KEY"),
            "Content-Type": "application/json",
            "Idempotency-Key": key,
        },
        body: JSON.stringify({
            from: required("BOOKING_FROM_EMAIL"),
            to: [recipient || required("BOOKING_OWNER_EMAIL")],
            subject,
            text: message,
            ...(replyTo ? { reply_to: replyTo } : {}),
        }),
        signal: AbortSignal.timeout(12000),
    });
    if (!response.ok)
        fail(
            "Your request is saved, but email delivery is delayed. Please retry to finish sending it or call +1 (613) 879-9461.",
            503,
        );
    return response.json();
}
async function rateLimit(key, max, seconds) {
    const limits = store("limits"),
        period = Math.floor(Date.now() / (seconds * 1000));
    for (let i = 0; i < 8; i++) {
        const name = hash(key) + "-" + period;
        const current = await limits.getWithMetadata(name, { type: "json" });
        if ((current?.data?.count || 0) >= max)
            fail("Too many requests. Please try again later.", 429);
        const changed = await limits.setJSON(
            name,
            { count: (current?.data?.count || 0) + 1 },
            current ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
        );
        if (changed.modified) return;
    }
    fail("Please try again in a moment.", 429);
}
async function getSession(request) {
    const token = request.headers
        .get("cookie")
        ?.match(/(?:^|;\s*)noble_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    const id = token ? hash(token) : "";
    const data = id ? await store("sessions").get(id, { type: "json" }) : null;
    return data && data.expires > Date.now() ? { id, ...data } : null;
}
async function memberActive(session) {
    if (!session?.verified || !session?.email) return false;
    const membership = await store("members").get(hash(session.email), {
        type: "json",
    });
    if (!membership) return false;
    // Never trust browser flags. Recheck subscription status at booking time too.
    const sub = await stripe(
        "/subscriptions/" + encodeURIComponent(membership.subscription),
    );
    return sub.status === "active";
}
async function refreshCheckout(session) {
    if (!session?.checkoutId) return;
    const paid = await stripe(
        "/checkout/sessions/" + encodeURIComponent(session.checkoutId),
    );
    if (
        paid.status === "complete" &&
        paid.payment_status === "paid" &&
        paid.amount_total === 1695 &&
        paid.currency === "cad" &&
        paid.customer_email?.toLowerCase() === session.email &&
        paid.subscription
    ) {
        await store("members").setJSON(hash(session.email), {
            subscription: paid.subscription,
        });
        session.verified = true;
        const { id, ...data } = session;
        await store("sessions").setJSON(id, data);
    }
}
function cookie(token) {
    return `noble_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}
async function newSession(address, verified = false) {
    const token = randomBytes(32).toString("hex"),
        id = hash(token);
    const data = {
        email: address,
        verified,
        expires: Date.now() + 30 * 86400000,
    };
    await store("sessions").setJSON(id, data);
    return { session: { id, ...data }, token };
}
function describe(record) {
    const result = [
        `Reference: ${record.reference}`,
        `Type: ${record.kind}`,
        `Status: ${record.data.slot?.custom ? "Custom time request — confirm with customer" : record.kind === "quote" ? "Quote request — contact customer" : "Reserved"}`,
    ];
    const d = record.data;
    result.push(
        `Name: ${d.contact.fullName}`,
        `Phone: ${d.contact.phone}`,
        `Email: ${d.contact.email}`,
        `Location: ${d.location}`,
        `Address: ${typeof d.address === "string" ? d.address : Object.values(d.address).filter(Boolean).join(", ")}`,
        `Date: ${d.date}`,
        `Time (America/Toronto): ${d.slot?.label || d.time}`,
        `Notes: ${d.contact.notes || "None"}`,
    );
    if (record.kind === "quote")
        result.push(
            `Vehicle: ${d.year} ${d.make} ${d.model} (${d.vehicleType})`,
            `Paint colour: ${d.colour}`,
            `Paint concerns: ${d.condition}`,
        );
    else {
        d.vehicles.forEach((car, i) =>
            result.push(
                `Car ${i + 1}: ${car.model} · ${catalog.vehicles[car.vehicleType][0]} · ${catalog.packages[car.packageId][0]}`,
            ),
        );
        record.receipt.lines.forEach(([label, amount]) =>
            result.push(`${label}: CAD $${amount}`),
        );
        result.push(
            `Service total before HST: CAD $${record.receipt.total}`,
            "Service payment due after the job. Membership is paid separately.",
            "Boat prices, if selected, are starting estimates depending on size.",
        );
    }
    return result.join("\n");
}
async function submit(kind, input, session) {
    // Check delivery configuration before taking any capacity.
    required("RESEND_API_KEY");
    required("BOOKING_FROM_EMAIL");
    required("BOOKING_OWNER_EMAIL");
    const key = text(input.idempotencyKey, 80);
    if (!/^[\w-]{10,80}$/.test(key))
        fail("Invalid request key. Reload and try again.");
    const records = store("requests"),
        id = hash(key),
        signature = hash(JSON.stringify(input));
    let record = await records.get(id, { type: "json" });
    if (record && (record.signature !== signature || record.kind !== kind))
        fail("This request changed. Please submit again.", 409);
    if (!record) {
        const data = kind === "quote" ? quote(input) : booking(input);
        const membershipActive =
            kind === "booking" && (await memberActive(session));
        if (
            membershipActive &&
            data.contact.email.toLowerCase() !== session.email
        )
            fail(
                "Use your verified membership email to receive the member discount.",
            );
        const reference = "ND-" + randomBytes(6).toString("hex").toUpperCase();
        const receipt =
            kind === "booking"
                ? {
                      reference,
                      ...catalog.price(
                          data.vehicles,
                          data.location,
                          membershipActive,
                      ),
                      membershipActive,
                      pending: !!data.slot.custom,
                  }
                : { reference };
        record = {
            reference,
            kind,
            signature,
            data,
            receipt,
            created: new Date().toISOString(),
            notified: false,
        };
        await records.setJSON(id, record, { onlyIfNew: true });
        record = await records.get(id, { type: "json" });
        if (record.signature !== signature || record.kind !== kind)
            fail("Request changed. Please retry.", 409);
    }
    if (kind === "booking" && !record.data.slot.custom)
        await reserve(
            store("slots"),
            record.data.slot.id,
            id,
            record.data.vehicles.length,
        );
    if (!record.notified) {
        // Email provider idempotency prevents duplicate owner messages on immediate retries.
        await sendMail(
            `${kind === "quote" ? "Paint correction quote" : record.data.slot.custom ? "Custom booking time request" : "New booking"} · ${record.reference}`,
            describe(record),
            "owner-" + id,
            undefined,
            record.data.contact.email,
        );
        record.notified = true;
        await records.setJSON(id, record);
    }
    return json(record.receipt);
}
export default async function handler(request, context) {
    try {
        const path = new URL(request.url).pathname.replace(/^\/api/, "") || "/";
        if (
            request.method !== "POST" &&
            !(request.method === "GET" && path === "/session")
        )
            return json({ error: "Method not allowed" }, 405);
        const origin = new URL(request.url).origin;
        if (request.method === "POST") {
            if (
                request.headers.get("origin") !== origin ||
                !request.headers
                    .get("content-type")
                    ?.startsWith("application/json")
            )
                fail("Invalid request origin.", 403);
            if (Number(request.headers.get("content-length") || 0) > 20000)
                fail("Request too large.", 413);
        }
        const raw = request.method === "POST" ? await request.text() : "{}";
        if (raw.length > 20000) fail("Request too large.", 413);
        let input;
        try {
            input = JSON.parse(raw);
        } catch {
            fail("Invalid request.");
        }
        if (!input || typeof input !== "object" || Array.isArray(input))
            fail("Invalid request.");
        const ip = context.ip || "unknown";
        await rateLimit("api:" + ip, 120, 60);
        let session = await getSession(request);
        if (path === "/session" && request.method === "GET") {
            await refreshCheckout(session);
            return json({
                signedIn: !!session?.verified,
                membershipActive: await memberActive(session),
            });
        }
        if (path === "/session/code") {
            const address = email(input.email);
            await rateLimit("code:" + ip, 5, 600);
            await rateLimit("email:" + address, 3, 600);
            const code = String(randomInt(100000, 1000000)),
                codeId = hash(address);
            const codes = store("codes");
            const record = {
                digest: hash(address + code),
                expires: Date.now() + 600000,
                attempts: 0,
            };
            await codes.setJSON(codeId, record);
            await sendMail(
                "Your Noble Detailing sign-in code",
                `Your sign-in code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`,
                randomBytes(16).toString("hex"),
                address,
            );
            return json({ sent: true });
        }
        if (path === "/session/verify") {
            await rateLimit("verify:" + ip, 10, 600);
            const address = email(input.email),
                codes = store("codes"),
                codeId = hash(address);
            const record = await codes.getWithMetadata(codeId, {
                type: "json",
            });
            if (
                !record ||
                record.data.expires < Date.now() ||
                record.data.attempts >= 5 ||
                record.data.used
            )
                fail("Invalid or expired code.");
            const matches = timingSafeEqual(
                Buffer.from(hash(address + text(input.code, 6))),
                Buffer.from(record.data.digest),
            );
            const changed = await codes.setJSON(
                codeId,
                {
                    ...record.data,
                    attempts: record.data.attempts + 1,
                    used: matches,
                },
                { onlyIfMatch: record.etag },
            );
            if (!changed.modified || !matches) fail("Invalid or expired code.");
            const created = await newSession(address, true);
            return json(
                {
                    signedIn: true,
                    membershipActive: await memberActive(created.session),
                },
                200,
                { "Set-Cookie": cookie(created.token) },
            );
        }
        if (path === "/membership/checkout") {
            await rateLimit("checkout:" + ip, 8, 3600);
            const address = email(input.email);
            // Checkout itself verifies payment ownership. It does not authenticate existing membership.
            if (session && session.email !== address)
                fail(
                    "Use your signed-in email, or sign in to a different account.",
                );
            if (await memberActive(session))
                fail(
                    "Your membership is already active. Check membership payment to continue.",
                );
            let token;
            if (!session) {
                const created = await newSession(address);
                session = created.session;
                token = created.token;
            }
            if (session.checkoutId) {
                const existing = await stripe(
                    "/checkout/sessions/" +
                        encodeURIComponent(session.checkoutId),
                );
                if (existing.status === "open")
                    return json(
                        { checkoutUrl: existing.url },
                        200,
                        token ? { "Set-Cookie": cookie(token) } : {},
                    );
                if (existing.status === "complete") {
                    await refreshCheckout(session);
                    fail(
                        "Membership payment already completed. Check your membership payment below.",
                    );
                }
            }
            const site = required("SITE_ORIGIN").replace(/\/$/, "");
            const checkout = await stripe(
                "/checkout/sessions",
                {
                    mode: "subscription",
                    customer_email: address,
                    success_url: site + "/booking/payment-return.html",
                    cancel_url:
                        site + "/booking/payment-return.html?cancelled=1",
                    "payment_method_types[0]": "card",
                    "line_items[0][price_data][currency]": "cad",
                    "line_items[0][price_data][unit_amount]": "1695",
                    "line_items[0][price_data][recurring][interval]": "year",
                    "line_items[0][price_data][product_data][name]":
                        "Royal Club annual membership — $15 + $1.95 HST",
                    "line_items[0][quantity]": "1",
                },
                "club-" + session.id + "-" + (session.checkoutId || "first"),
            );
            await store("sessions").setJSON(session.id, {
                email: session.email,
                verified: session.verified,
                expires: session.expires,
                checkoutId: checkout.id,
            });
            return json(
                { checkoutUrl: checkout.url },
                200,
                token ? { "Set-Cookie": cookie(token) } : {},
            );
        }
        if (path === "/availability") {
            if (!/^\d{4}-\d{2}$/.test(input.month || ""))
                fail("Invalid month.");
            const dates = {},
                count = input.vehicles?.length || 1;
            if (!Number.isInteger(count) || count < 1 || count > catalog.slotCapacity)
                fail(`An appointment can take up to ${catalog.slotCapacity} vehicles.`);
            await Promise.all(
                Array.from({ length: 31 }, async (_, index) => {
                    const day = index + 1;
                    const date =
                        input.month + "-" + String(day).padStart(2, "0");
                    try {
                        validDate(date);
                    } catch {
                        return;
                    }
                    const available = await Promise.all(
                        catalog.slots(date).map(async (slot) => {
                            if (pastSlot(date, slot.time)) return null;
                            const existing =
                                (await store("slots").get(slot.id, {
                                    type: "json",
                                })) || {};
                            return Object.values(existing).reduce(
                                (a, b) => a + b,
                                0,
                            ) +
                                count <=
                                catalog.slotCapacity
                                ? slot
                                : null;
                        }),
                    );
                    // Keep the date selectable even if only custom-time requests remain.
                    dates[date] = available.filter(Boolean);
                }),
            );
            return json({ dates });
        }
        if (path === "/bookings" || path === "/quotes") {
            await rateLimit("submit:" + ip, 15, 3600);
            return await submit(
                path === "/quotes" ? "quote" : "booking",
                input,
                session,
            );
        }
        return json({ error: "Not found" }, 404);
    } catch (error) {
        if (!error.status) console.error("Booking API failed:", error.name);
        return json(
            {
                error: error.status
                    ? error.message
                    : "We could not complete this request. Please try again or call +1 (613) 879-9461.",
            },
            error.status || 503,
        );
    }
}
export const config = { path: "/api/*" };
