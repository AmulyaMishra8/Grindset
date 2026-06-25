// Per-problem starter stubs (what the editor pre-fills) and curated test cases
// (what the "Run" button executes in the sandbox). Keyed by problem slug.
//
// Each function is a deterministic PURE function so the sandbox can check it.
// The few problems that aren't naturally pure (image upload, API retry) are
// reframed down to their testable logic core (thumbnail math, retry decision).
//
// Test cases carry the EXPECTED value directly — no reference solution needed.
// Number comparison is tolerant (1e-6) and object comparison is key-order-
// independent (see executors/runHarness.ts), so float noise and key ordering
// never cause false failures.

export type TestCase = {
  description: string;
  args: unknown[];
  expect?: unknown;   // deep-equal (tolerant) expected return value
  throws?: string;    // case-insensitive substring the thrown error must contain
};

export type TestSpec = {
  functionName: string;
  isAsync: boolean;
  cases: TestCase[];
};

export type Stub = { javascript: string; python: string };

const FAR_FUTURE = "2099-12-31T00:00:00Z";
const PAST = "2020-01-01T00:00:00Z";

// ─────────────────────────────────────────────────────────────────────────────
export const stubs: Record<string, Stub> = {
  "coupon-redemption": {
    javascript: `// coupon: { code, discount_percent, expires_at, max_uses, flash_sale }
//   discount_percent is a decimal: 0.15 means 15%
// cartTotal: number (dollars)
// flashCounter: { redemptions: number } — shared counter, mutate in place
//
// Validate: throw if expired (message contains "expired"),
//           throw if no uses left (message contains "limit").
// Apply the coupon discount. If flash_sale is true AND flashCounter.redemptions
//   < 100, stack an extra 10% and increment the counter. Never go below 0.
// Return { finalTotal, discountsApplied } where discountsApplied is an array
//   containing "coupon" and (if it applied) "flash".
function redeemCoupon(coupon, cartTotal, flashCounter) {
  // TODO: implement
}`,
    python: `# coupon: dict { code, discount_percent, expires_at, max_uses, flash_sale }
#   discount_percent is a decimal: 0.15 means 15%
# cartTotal: float (dollars)
# flashCounter: dict { "redemptions": int } — mutate in place
#
# Raise on expired (message contains "expired") or no uses left ("limit").
# Apply coupon discount; if flash_sale and flashCounter["redemptions"] < 100,
#   stack an extra 10% and increment the counter. Never go below 0.
# Return { "finalTotal": ..., "discountsApplied": [...] } with "coupon" and
#   (if it applied) "flash".
def redeemCoupon(coupon, cartTotal, flashCounter):
    pass`,
  },

  "contact-merge-cli": {
    javascript: `// records: Array<{ email, name, phone }> — already parsed, headers normalised.
//
// - Normalise email: trim + lowercase.
// - Records with no email (empty/missing) are ALL kept (never deduped).
// - Records sharing the same normalised email collapse into ONE; for name and
//   phone keep the FIRST non-empty value in input order. email = normalised.
// - Return the contacts sorted by name ascending (case-insensitive);
//   records with an empty name sort to the END.
//   Each record is { email, name, phone }.
function mergeContacts(records) {
  // TODO: implement
}`,
    python: `# records: list of dict { "email", "name", "phone" } — already parsed.
#
# - Normalise email: strip + lowercase.
# - Records with no email are ALL kept (never deduped).
# - Records with the same normalised email collapse into ONE; for name and
#   phone keep the FIRST non-empty value in input order.
# - Return contacts sorted by name ascending (case-insensitive); empty names
#   sort to the END. Each record is { "email", "name", "phone" }.
def mergeContacts(records):
    pass`,
  },

  "ledger-reconciliation": {
    javascript: `// processorRows: [{ order_id, transaction_id, amount_cents }]  (integer cents)
// internalRows:  [{ order_id, amount }]  (dollars, two decimals)
//
// - Compare amounts in INTEGER cents (round(amount * 100)) to avoid float errors.
// - Collapse processor rows sharing the same transaction_id (retries) into one.
// - Match on order_id. Return four buckets, each an array of order_id sorted
//   ascending:
//     matched              — in both, amounts equal
//     missingFromProcessor — in internal only
//     missingFromInternal  — in processor only
//     amountMismatches     — in both, amounts differ
function reconcile(processorRows, internalRows) {
  // TODO: implement
}`,
    python: `# processor_rows: list of { "order_id", "transaction_id", "amount_cents" } (cents)
# internal_rows:  list of { "order_id", "amount" } (dollars, 2 decimals)
#
# - Compare in INTEGER cents (round(amount * 100)).
# - Collapse processor rows sharing the same transaction_id (retries) into one.
# - Match on order_id. Return four buckets, each a sorted list of order_id:
#     matched, missingFromProcessor, missingFromInternal, amountMismatches
def reconcile(processorRows, internalRows):
    pass`,
  },

  "api-client-retry": {
    javascript: `// Decide how long to wait before the next retry, or whether to give up.
// status: HTTP status of the failed attempt (0 = timeout / network error)
// attempt: 0-based index of the attempt that just failed
// maxRetries: max number of retries allowed
// baseDelayMs: base backoff delay
// retryAfterSeconds: value from a Retry-After header (seconds), or null
//
// Rules:
//  - Non-retryable statuses (400, 401, 403, 404) -> return -1 (never retry)
//  - If attempt >= maxRetries -> return -1 (give up)
//  - Retryable (0 timeout, 429, 500, 502, 503):
//      * 429 with retryAfterSeconds != null -> wait retryAfterSeconds * 1000
//      * otherwise exponential backoff -> baseDelayMs * 2^attempt
//  Return the delay in milliseconds (or -1).
function nextRetryDelay(status, attempt, maxRetries, baseDelayMs, retryAfterSeconds) {
  // TODO: implement
}`,
    python: `# Decide how long to wait before the next retry, or whether to give up.
# status: HTTP status of the failed attempt (0 = timeout / network error)
# attempt: 0-based index of the attempt that just failed
# max_retries, base_delay_ms, retry_after_seconds (seconds or None)
#
# - Non-retryable (400,401,403,404) -> return -1
# - attempt >= max_retries -> return -1
# - Retryable (0,429,500,502,503):
#     429 with retry_after_seconds not None -> retry_after_seconds * 1000
#     else exponential backoff -> base_delay_ms * 2**attempt
def nextRetryDelay(status, attempt, maxRetries, baseDelayMs, retryAfterSeconds):
    pass`,
  },

  "image-upload-thumbnail": {
    javascript: `// file: { type, sizeBytes, width, height }  (type = the REAL decoded mime type)
// opts: { maxBytes, targetWidth, allowedTypes }
//
// Validate (throw Error on failure):
//   - sizeBytes <= 0           -> message contains "empty"
//   - type not in allowedTypes -> message contains "unsupported"
//   - sizeBytes > maxBytes     -> message contains "too large"
// On success return { thumbnail: { width, height } } scaled to targetWidth,
//   preserving aspect ratio. Do NOT upscale: if width <= targetWidth keep the
//   original dimensions. Round height to the nearest integer.
function processUpload(file, opts) {
  // TODO: implement
}`,
    python: `# file: { "type", "sizeBytes", "width", "height" } (type = real decoded mime)
# opts: { "maxBytes", "targetWidth", "allowedTypes" }
#
# Raise on: sizeBytes <= 0 ("empty"), type not allowed ("unsupported"),
#           sizeBytes > maxBytes ("too large").
# Else return { "thumbnail": { "width", "height" } } scaled to targetWidth
#   keeping aspect ratio; never upscale; round height.
def processUpload(file, opts):
    pass`,
  },

  "booking-availability": {
    javascript: `// All times are minutes from midnight (caller already converted to the
//   provider's timezone).
// workStart, workEnd: working hours (e.g. 540 = 09:00, 1020 = 17:00)
// slotMinutes: slot length
// bookings: [{ start, end }] booked/blocked intervals (minutes)
// nowMinutes: current time; exclude slots starting before it. Use -1 to disable.
//
// A slot [s, s + slotMinutes) is available if it fits within work hours
//   (s + slotMinutes <= workEnd) and overlaps NO booking
//   (overlap = s < b.end && b.start < s + slotMinutes).
// Slots start at workStart and step by slotMinutes.
// Return the available start times (minutes), ascending.
function availableSlots(workStart, workEnd, slotMinutes, bookings, nowMinutes) {
  // TODO: implement
}`,
    python: `# Times are minutes from midnight (already in the provider's timezone).
# work_start, work_end, slot_minutes, bookings: list of { "start", "end" },
# now_minutes (-1 to disable the past filter).
#
# A slot [s, s+slot) is available if s + slot <= work_end and it overlaps no
#   booking (s < b["end"] and b["start"] < s + slot). Slots step by slot_minutes
#   from work_start. Return available start times ascending.
def availableSlots(workStart, workEnd, slotMinutes, bookings, nowMinutes):
    pass`,
  },
};

// Reference answers (one correct solution per language). Revealed to the
// candidate only AFTER they submit — never sent with the initial problem.
// These match the curated test contracts (verified to pass every case).
export const answers: Record<string, { javascript: string; python: string }> = {
  "coupon-redemption": {
    javascript: `function redeemCoupon(coupon, cartTotal, flashCounter) {
  if (new Date(coupon.expires_at) <= new Date()) throw new Error("Coupon has expired");
  if (coupon.max_uses <= 0) throw new Error("Coupon usage limit reached");

  let discount = cartTotal * coupon.discount_percent;
  const discountsApplied = ["coupon"];

  // Flash bonus is gated on a shared counter — in production the check-and-
  // increment must be atomic (e.g. UPDATE ... WHERE redemptions < 100).
  if (coupon.flash_sale && flashCounter && flashCounter.redemptions < 100) {
    discount += cartTotal * 0.10;
    flashCounter.redemptions += 1;
    discountsApplied.push("flash");
  }

  return { finalTotal: Math.max(cartTotal - discount, 0), discountsApplied };
}`,
    python: `from datetime import datetime, timezone

def redeemCoupon(coupon, cartTotal, flashCounter):
    if datetime.fromisoformat(coupon["expires_at"].replace("Z", "+00:00")) <= datetime.now(timezone.utc):
        raise Exception("Coupon has expired")
    if coupon["max_uses"] <= 0:
        raise Exception("Coupon usage limit reached")

    discount = cartTotal * coupon["discount_percent"]
    applied = ["coupon"]

    if coupon.get("flash_sale") and flashCounter and flashCounter["redemptions"] < 100:
        discount += cartTotal * 0.10
        flashCounter["redemptions"] += 1
        applied.append("flash")

    return {"finalTotal": max(cartTotal - discount, 0), "discountsApplied": applied}`,
  },

  "contact-merge-cli": {
    javascript: `function mergeContacts(records) {
  const noEmail = [];
  const byEmail = new Map();

  for (const r of records) {
    const email = (r.email || "").trim().toLowerCase();
    if (!email) {
      noEmail.push({ email: "", name: r.name || "", phone: r.phone || "" });
      continue;
    }
    if (!byEmail.has(email)) {
      byEmail.set(email, { email, name: r.name || "", phone: r.phone || "" });
    } else {
      const ex = byEmail.get(email);
      if (!ex.name && r.name) ex.name = r.name;
      if (!ex.phone && r.phone) ex.phone = r.phone;
    }
  }

  const all = [...byEmail.values(), ...noEmail];
  all.sort((a, b) => {
    if (!a.name && !b.name) return 0;
    if (!a.name) return 1;   // empty names sort to the end
    if (!b.name) return -1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
  return all;
}`,
    python: `def mergeContacts(records):
    no_email = []
    by_email = {}
    for r in records:
        email = (r.get("email") or "").strip().lower()
        if not email:
            no_email.append({"email": "", "name": r.get("name") or "", "phone": r.get("phone") or ""})
            continue
        if email not in by_email:
            by_email[email] = {"email": email, "name": r.get("name") or "", "phone": r.get("phone") or ""}
        else:
            ex = by_email[email]
            if not ex["name"] and r.get("name"): ex["name"] = r["name"]
            if not ex["phone"] and r.get("phone"): ex["phone"] = r["phone"]

    result = list(by_email.values()) + no_email
    result.sort(key=lambda c: (c["name"] == "", c["name"].lower()))  # empty names last
    return result`,
  },

  "ledger-reconciliation": {
    javascript: `function reconcile(processorRows, internalRows) {
  const seen = new Set();
  const proc = new Map();
  for (const r of processorRows) {
    if (seen.has(r.transaction_id)) continue; // collapse retries
    seen.add(r.transaction_id);
    proc.set(r.order_id, r.amount_cents);
  }

  // Compare in integer cents to avoid float drift (10.10 * 100 !== 1010 in floats).
  const intern = new Map();
  for (const r of internalRows) intern.set(r.order_id, Math.round(r.amount * 100));

  const matched = [], missingFromProcessor = [], missingFromInternal = [], amountMismatches = [];
  for (const [oid, cents] of intern) {
    if (!proc.has(oid)) missingFromProcessor.push(oid);
    else if (proc.get(oid) === cents) matched.push(oid);
    else amountMismatches.push(oid);
  }
  for (const [oid] of proc) if (!intern.has(oid)) missingFromInternal.push(oid);

  const s = (a) => a.sort();
  return {
    matched: s(matched),
    missingFromProcessor: s(missingFromProcessor),
    missingFromInternal: s(missingFromInternal),
    amountMismatches: s(amountMismatches),
  };
}`,
    python: `def reconcile(processorRows, internalRows):
    seen = set()
    proc = {}
    for r in processorRows:
        if r["transaction_id"] in seen:  # collapse retries
            continue
        seen.add(r["transaction_id"])
        proc[r["order_id"]] = r["amount_cents"]

    intern = {r["order_id"]: round(r["amount"] * 100) for r in internalRows}

    matched, mfp, mfi, mism = [], [], [], []
    for oid, cents in intern.items():
        if oid not in proc: mfp.append(oid)
        elif proc[oid] == cents: matched.append(oid)
        else: mism.append(oid)
    for oid in proc:
        if oid not in intern: mfi.append(oid)

    return {
        "matched": sorted(matched),
        "missingFromProcessor": sorted(mfp),
        "missingFromInternal": sorted(mfi),
        "amountMismatches": sorted(mism),
    }`,
  },

  "api-client-retry": {
    javascript: `function nextRetryDelay(status, attempt, maxRetries, baseDelayMs, retryAfterSeconds) {
  if ([400, 401, 403, 404].includes(status)) return -1; // never retry client errors
  if (attempt >= maxRetries) return -1;                  // out of attempts

  // Honour the server's Retry-After on a 429; otherwise exponential backoff.
  if (status === 429 && retryAfterSeconds != null) return retryAfterSeconds * 1000;
  return baseDelayMs * Math.pow(2, attempt);
}`,
    python: `def nextRetryDelay(status, attempt, maxRetries, baseDelayMs, retryAfterSeconds):
    if status in (400, 401, 403, 404):  # never retry client errors
        return -1
    if attempt >= maxRetries:           # out of attempts
        return -1
    if status == 429 and retryAfterSeconds is not None:
        return retryAfterSeconds * 1000
    return baseDelayMs * (2 ** attempt)`,
  },

  "image-upload-thumbnail": {
    javascript: `function processUpload(file, opts) {
  if (file.sizeBytes <= 0) throw new Error("empty file");
  if (!opts.allowedTypes.includes(file.type)) throw new Error("unsupported type");
  if (file.sizeBytes > opts.maxBytes) throw new Error("file too large");

  let { width, height } = file;
  if (width > opts.targetWidth) {
    height = Math.round(height * opts.targetWidth / width); // keep aspect ratio
    width = opts.targetWidth;
  }
  return { thumbnail: { width, height } };
}`,
    python: `def processUpload(file, opts):
    if file["sizeBytes"] <= 0:
        raise Exception("empty file")
    if file["type"] not in opts["allowedTypes"]:
        raise Exception("unsupported type")
    if file["sizeBytes"] > opts["maxBytes"]:
        raise Exception("file too large")

    w, h = file["width"], file["height"]
    if w > opts["targetWidth"]:
        h = round(h * opts["targetWidth"] / w)  # keep aspect ratio
        w = opts["targetWidth"]
    return {"thumbnail": {"width": w, "height": h}}`,
  },

  "booking-availability": {
    javascript: `function availableSlots(workStart, workEnd, slotMinutes, bookings, nowMinutes) {
  const out = [];
  for (let s = workStart; s + slotMinutes <= workEnd; s += slotMinutes) {
    if (nowMinutes >= 0 && s < nowMinutes) continue; // past slot
    // A slot is blocked if it overlaps ANY booking (interval overlap, not equality).
    const blocked = bookings.some((b) => s < b.end && b.start < s + slotMinutes);
    if (!blocked) out.push(s);
  }
  return out;
}`,
    python: `def availableSlots(workStart, workEnd, slotMinutes, bookings, nowMinutes):
    out = []
    s = workStart
    while s + slotMinutes <= workEnd:
        if not (nowMinutes >= 0 and s < nowMinutes):
            # blocked if the slot overlaps ANY booking (interval overlap, not equality)
            if not any(s < b["end"] and b["start"] < s + slotMinutes for b in bookings):
                out.append(s)
        s += slotMinutes
    return out`,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
export const tests: Record<string, TestSpec> = {
  "coupon-redemption": {
    functionName: "redeemCoupon",
    isAsync: false,
    cases: [
      {
        description: "15% off a $100 cart",
        args: [{ code: "SAVE15", discount_percent: 0.15, expires_at: FAR_FUTURE, max_uses: 5, flash_sale: false }, 100, { redemptions: 0 }],
        expect: { finalTotal: 85, discountsApplied: ["coupon"] },
      },
      {
        description: "expired coupon is rejected",
        args: [{ code: "OLD", discount_percent: 0.2, expires_at: PAST, max_uses: 5, flash_sale: false }, 100, { redemptions: 0 }],
        throws: "expired",
      },
      {
        description: "coupon with no uses left is rejected",
        args: [{ code: "DONE", discount_percent: 0.2, expires_at: FAR_FUTURE, max_uses: 0, flash_sale: false }, 100, { redemptions: 0 }],
        throws: "limit",
      },
      {
        description: "flash sale stacks an extra 10%",
        args: [{ code: "FLASH", discount_percent: 0.15, expires_at: FAR_FUTURE, max_uses: 5, flash_sale: true }, 100, { redemptions: 0 }],
        expect: { finalTotal: 75, discountsApplied: ["coupon", "flash"] },
      },
      {
        description: "discount over the cart total clamps to 0",
        args: [{ code: "FULL", discount_percent: 1.0, expires_at: FAR_FUTURE, max_uses: 5, flash_sale: false }, 50, { redemptions: 0 }],
        expect: { finalTotal: 0, discountsApplied: ["coupon"] },
      },
      {
        description: "flash counter at 100 does NOT grant the bonus",
        args: [{ code: "FLASH", discount_percent: 0.15, expires_at: FAR_FUTURE, max_uses: 5, flash_sale: true }, 100, { redemptions: 100 }],
        expect: { finalTotal: 85, discountsApplied: ["coupon"] },
      },
      {
        description: "flash_sale false never stacks",
        args: [{ code: "NOPE", discount_percent: 0.1, expires_at: FAR_FUTURE, max_uses: 5, flash_sale: false }, 200, { redemptions: 0 }],
        expect: { finalTotal: 180, discountsApplied: ["coupon"] },
      },
    ],
  },

  "contact-merge-cli": {
    functionName: "mergeContacts",
    isAsync: false,
    cases: [
      {
        description: "dedupes emails differing by case and whitespace",
        args: [[
          { email: "Bob@X.com", name: "Bob", phone: "" },
          { email: " bob@x.com ", name: "", phone: "555-1" },
        ]],
        expect: [{ email: "bob@x.com", name: "Bob", phone: "555-1" }],
      },
      {
        description: "rows with no email are all kept",
        args: [[
          { email: "", name: "Zoe", phone: "111" },
          { email: "", name: "Ann", phone: "222" },
        ]],
        expect: [
          { email: "", name: "Ann", phone: "222" },
          { email: "", name: "Zoe", phone: "111" },
        ],
      },
      {
        description: "merge keeps first non-empty field, sorts by name",
        args: [[
          { email: "a@x.com", name: "Cara", phone: "" },
          { email: "A@X.com", name: "Cara", phone: "999" },
          { email: "b@x.com", name: "Bert", phone: "1" },
        ]],
        expect: [
          { email: "b@x.com", name: "Bert", phone: "1" },
          { email: "a@x.com", name: "Cara", phone: "999" },
        ],
      },
      {
        description: "empty names sort to the end",
        args: [[
          { email: "x@x.com", name: "", phone: "5" },
          { email: "y@x.com", name: "Amy", phone: "6" },
        ]],
        expect: [
          { email: "y@x.com", name: "Amy", phone: "6" },
          { email: "x@x.com", name: "", phone: "5" },
        ],
      },
    ],
  },

  "ledger-reconciliation": {
    functionName: "reconcile",
    isAsync: false,
    cases: [
      {
        description: "$10.00 matches 1000 cents (no float error)",
        args: [[{ order_id: "A", transaction_id: "t1", amount_cents: 1000 }], [{ order_id: "A", amount: 10.0 }]],
        expect: { matched: ["A"], missingFromProcessor: [], missingFromInternal: [], amountMismatches: [] },
      },
      {
        description: "differing amounts go to amountMismatches",
        args: [[{ order_id: "B", transaction_id: "t2", amount_cents: 1050 }], [{ order_id: "B", amount: 10.0 }]],
        expect: { matched: [], missingFromProcessor: [], missingFromInternal: [], amountMismatches: ["B"] },
      },
      {
        description: "in processor only -> missingFromInternal",
        args: [[{ order_id: "C", transaction_id: "t3", amount_cents: 500 }], []],
        expect: { matched: [], missingFromProcessor: [], missingFromInternal: ["C"], amountMismatches: [] },
      },
      {
        description: "in internal only -> missingFromProcessor",
        args: [[], [{ order_id: "D", amount: 5.0 }]],
        expect: { matched: [], missingFromProcessor: ["D"], missingFromInternal: [], amountMismatches: [] },
      },
      {
        description: "duplicate retry (same transaction_id) counts once",
        args: [[
          { order_id: "E", transaction_id: "t5", amount_cents: 2000 },
          { order_id: "E", transaction_id: "t5", amount_cents: 2000 },
        ], [{ order_id: "E", amount: 20.0 }]],
        expect: { matched: ["E"], missingFromProcessor: [], missingFromInternal: [], amountMismatches: [] },
      },
      {
        description: "$10.10 vs 1010 cents matches via integer rounding",
        args: [[{ order_id: "F", transaction_id: "t6", amount_cents: 1010 }], [{ order_id: "F", amount: 10.1 }]],
        expect: { matched: ["F"], missingFromProcessor: [], missingFromInternal: [], amountMismatches: [] },
      },
      {
        description: "all four buckets at once, sorted",
        args: [[
          { order_id: "m1", transaction_id: "a", amount_cents: 100 },
          { order_id: "mm", transaction_id: "b", amount_cents: 250 },
          { order_id: "po", transaction_id: "c", amount_cents: 700 },
        ], [
          { order_id: "m1", amount: 1.0 },
          { order_id: "mm", amount: 3.0 },
          { order_id: "io", amount: 9.0 },
        ]],
        expect: { matched: ["m1"], missingFromProcessor: ["io"], missingFromInternal: ["po"], amountMismatches: ["mm"] },
      },
    ],
  },

  "api-client-retry": {
    functionName: "nextRetryDelay",
    isAsync: false,
    cases: [
      { description: "500 on first attempt -> base delay", args: [500, 0, 3, 100, null], expect: 100 },
      { description: "exponential backoff doubles each attempt", args: [500, 1, 3, 100, null], expect: 200 },
      { description: "503 on attempt 2 -> 4x base", args: [503, 2, 3, 100, null], expect: 400 },
      { description: "404 is never retried", args: [404, 0, 3, 100, null], expect: -1 },
      { description: "400 is never retried", args: [400, 0, 3, 100, null], expect: -1 },
      { description: "gives up once attempts are exhausted", args: [500, 3, 3, 100, null], expect: -1 },
      { description: "429 honours Retry-After seconds", args: [429, 0, 3, 100, 5], expect: 5000 },
      { description: "timeout (status 0) is retryable", args: [0, 0, 3, 100, null], expect: 100 },
      { description: "maxRetries 0 means no retry at all", args: [500, 0, 0, 100, null], expect: -1 },
    ],
  },

  "image-upload-thumbnail": {
    functionName: "processUpload",
    isAsync: false,
    cases: [
      {
        description: "1000x500 JPEG scales to 200x100",
        args: [{ type: "image/jpeg", sizeBytes: 500000, width: 1000, height: 500 }, { maxBytes: 10485760, targetWidth: 200, allowedTypes: ["image/jpeg", "image/png"] }],
        expect: { thumbnail: { width: 200, height: 100 } },
      },
      {
        description: "very tall image keeps aspect ratio (200x2000)",
        args: [{ type: "image/png", sizeBytes: 800000, width: 400, height: 4000 }, { maxBytes: 10485760, targetWidth: 200, allowedTypes: ["image/jpeg", "image/png"] }],
        expect: { thumbnail: { width: 200, height: 2000 } },
      },
      {
        description: "image narrower than target is not upscaled",
        args: [{ type: "image/png", sizeBytes: 1000, width: 100, height: 80 }, { maxBytes: 10485760, targetWidth: 200, allowedTypes: ["image/jpeg", "image/png"] }],
        expect: { thumbnail: { width: 100, height: 80 } },
      },
      {
        description: "height is rounded to the nearest integer",
        args: [{ type: "image/jpeg", sizeBytes: 1000, width: 1000, height: 333 }, { maxBytes: 10485760, targetWidth: 200, allowedTypes: ["image/jpeg", "image/png"] }],
        expect: { thumbnail: { width: 200, height: 67 } },
      },
      {
        description: "non-image type is rejected",
        args: [{ type: "application/pdf", sizeBytes: 1000, width: 0, height: 0 }, { maxBytes: 10485760, targetWidth: 200, allowedTypes: ["image/jpeg", "image/png"] }],
        throws: "unsupported",
      },
      {
        description: "file over the size cap is rejected",
        args: [{ type: "image/jpeg", sizeBytes: 10485761, width: 100, height: 100 }, { maxBytes: 10485760, targetWidth: 200, allowedTypes: ["image/jpeg", "image/png"] }],
        throws: "too large",
      },
      {
        description: "0-byte file is rejected",
        args: [{ type: "image/jpeg", sizeBytes: 0, width: 100, height: 100 }, { maxBytes: 10485760, targetWidth: 200, allowedTypes: ["image/jpeg", "image/png"] }],
        throws: "empty",
      },
      {
        description: "file at exactly the cap is accepted",
        args: [{ type: "image/png", sizeBytes: 10485760, width: 800, height: 600 }, { maxBytes: 10485760, targetWidth: 200, allowedTypes: ["image/jpeg", "image/png"] }],
        expect: { thumbnail: { width: 200, height: 150 } },
      },
    ],
  },

  "booking-availability": {
    functionName: "availableSlots",
    isAsync: false,
    cases: [
      {
        description: "no bookings -> every slot in the window",
        args: [540, 660, 30, [], -1],
        expect: [540, 570, 600, 630],
      },
      {
        description: "an exact booking removes that one slot",
        args: [540, 660, 30, [{ start: 600, end: 630 }], -1],
        expect: [540, 570, 630],
      },
      {
        description: "a misaligned block removes every overlapping slot",
        args: [540, 660, 30, [{ start: 615, end: 645 }], -1],
        expect: [540, 570],
      },
      {
        description: "a long booking blocks several slots",
        args: [540, 720, 30, [{ start: 600, end: 720 }], -1],
        expect: [540, 570],
      },
      {
        description: "hours not divisible by slot drop the remainder",
        args: [540, 650, 30, [], -1],
        expect: [540, 570, 600],
      },
      {
        description: "past slots are filtered out",
        args: [540, 660, 30, [], 600],
        expect: [600, 630],
      },
    ],
  },
};
