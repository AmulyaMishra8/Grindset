import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({ connectionString: process.env.DATABASE });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const problems = [
  {
    slug: "coupon-redemption",
    title: "Coupon redemption endpoint",
    domain: "Backend service / endpoint",
    difficulty: "Medium",
    estimatedMinutes: 60,
    problemStatement: `Hey, checkout team needs the coupon discount logic before Friday — told them we'd have it done.

The API layer is already built. We fetch the coupon from the DB before calling your function, so you receive the full coupon object directly. Here's the stub to implement:

\`\`\`javascript
function redeemCoupon(coupon, cartTotal, flashCounter) {
  // coupon: { code, discount_percent, expires_at, max_uses, flash_sale }
  // cartTotal: number (dollars)
  // flashCounter: { redemptions: number } — shared counter, mutate in place
}
\`\`\`

Validate the coupon — reject if expired, reject if it's hit max_uses. Apply the discount. discount_percent is a decimal, so 0.15 means 15%. Return the final total and which discounts were applied so the frontend can show the breakdown. Never let the total go below zero.

Flash sale next week: if flash_sale is true on the coupon and the flashCounter is under 100, stack an extra 10% off. We'll see a few hundred redemptions a minute during the sale — keep that in mind.

Marketing wants codes case-insensitive. We handle the lookup normalisation on our side before the call.`,
    chatFormat: {
      messages: [
        {
          text: "Hey, checkout team needs the coupon discount logic before Friday — told them we'd have it done. The API layer is already built, we just need the function that does the actual calculation.",
          timestamp: "10:23 AM",
        },
        {
          text: "We fetch the coupon from DB on our side before calling you, so your function gets the full object passed in: `{ code, discount_percent, expires_at, max_uses, flash_sale }`. You also get the cart total and a `flashCounter: { redemptions: number }` for the flash sale — mutate it in place.",
          timestamp: "10:23 AM",
        },
        {
          text: "Stub is `function redeemCoupon(coupon, cartTotal, flashCounter)`. Validate expiry + max_uses, apply the coupon discount (decimal — 0.15 means 15%), handle flash sale stacking (extra 10% for the first 100 globally), clamp to zero, return `{ finalTotal, discountsApplied }`. Flash sale starts next week, expecting a few hundred hits a minute so don't make it fragile.",
          timestamp: "10:24 AM",
        },
      ],
      reactions: [
        { emoji: "👍", count: 3 },
        { emoji: "🔥", count: 2 },
      ],
    },
    sealedExpectations: {
      ambiguitiesToClarify: [
        "Is max_uses a global limit or per-customer? The brief never says — these require completely different tracking schemas.",
        "Is the flash sale counter (first 100) per-coupon or global across all coupons? The brief says 'first 100 customers' but doesn't say 100 per what.",
        "Are discounts stacked additively (15% + 10% = 25% off) or multiplicatively (15% off, then 10% off the remainder)? Both are valid reads of 'stacking'.",
      ],
      missingRequirement: {
        what: "The flashCounter is a shared mutable object — under a few hundred redemptions a minute, incrementing it with flashCounter.redemptions += 1 is a race condition. Two requests can both read redemptions = 99, both pass the < 100 check, and both grant the flash discount, overselling past 100.",
        why: "The function signature hands you a mutable object but gives no atomicity guarantee. A senior should ask: who owns persisting this counter, and how do we make the check-and-increment atomic? This is the core trap — it passes every single-threaded test and breaks under real load.",
      },
      trap: {
        description: "'Keep it simple, ship Friday' collides with 'a few hundred redemptions a minute' and a shared counter. The natural implementation (check < 100, then increment) is a classic check-then-act race. It looks correct in isolation and fails under concurrency.",
        correctResolution: "The atomic increment must happen in the persistence layer (e.g. UPDATE ... WHERE redemptions < 100, check affected rows). The pure function can do the math but the caller is responsible for making the counter safe. A senior surfaces this constraint before writing anything.",
      },
      edgeCasesToTest: [
        "Expired coupon (expires_at in the past)",
        "Coupon at exactly max_uses (must reject)",
        "Discount that exceeds cart total (clamp to 0, never negative)",
        "flashCounter at exactly 99 vs 100 (boundary)",
        "flash_sale = false — extra 10% must NOT apply",
        "flashCounter is null/undefined — must not crash",
        "discount_percent = 1.0 (100% off) with stacking — result must still clamp to 0",
      ],
      designDecisionRedFlags: [
        "Treating discount_percent as 15 instead of 0.15 — the AI commonly ignores the stated decimal convention",
        "Silently assuming max_uses is global without asking — the answer changes the whole schema",
        "Accepting the AI's check-then-increment without flagging the race condition under concurrency",
      ],
    },
    referenceCode: {
      javascript: `// coupon: { code, discount_percent, expires_at, max_uses, flash_sale }
// flashCounter: { redemptions } — shared atomic counter, mutated in place
// cartTotal: number (dollars)
function redeemCoupon(coupon, cartTotal, flashCounter) {
  if (!coupon) throw new Error('Coupon not found');

  // Normalise code comparison happens before this call (caller lowercases the lookup key)

  if (new Date(coupon.expires_at) <= new Date()) {
    throw new Error('Coupon has expired');
  }

  // max_uses is a global limit; guard before decrement
  if (coupon.max_uses <= 0) {
    throw new Error('Coupon usage limit reached');
  }

  // discount_percent stored as decimal: 0.15 = 15%
  let discountAmount = cartTotal * coupon.discount_percent;
  const discountsApplied = [\`\${coupon.discount_percent * 100}% coupon discount\`];

  // Flash sale: first 100 redemptions globally get an extra 10% stacked
  // flashCounter must be locked (SELECT FOR UPDATE) before this call in a real DB tx
  if (coupon.flash_sale && flashCounter && flashCounter.redemptions < 100) {
    discountAmount += cartTotal * 0.10;
    flashCounter.redemptions += 1;          // caller persists this atomically
    discountsApplied.push('10% flash sale discount');
  }

  // Atomic decrement — caller persists with conditional UPDATE ... WHERE max_uses > 0
  coupon.max_uses -= 1;

  // Never go below zero
  const finalTotal = Math.max(cartTotal - discountAmount, 0);

  return { finalTotal, discountsApplied };
}`,
    },
  },
  {
    slug: "contact-merge-cli",
    title: "Merge & dedupe contact exports (CLI)",
    domain: "CLI tool",
    difficulty: "Medium",
    estimatedMinutes: 60,
    problemStatement: `Can you write a small CLI that merges our contact exports into one clean list? We pull contacts from Mailchimp, the CRM, and a manual spreadsheet, and they're a mess. It should take several input CSVs and produce one deduped output CSV. Dedupe on email. They all have an email column and a name column but the headers are named differently across tools — Email, email_address, E-Mail, etc. When the same email shows up in more than one file, merge the records and keep the most complete one. Output sorted by name. Heads up: a bunch of the manual spreadsheet rows have no email at all — people just put a phone number — and we can't lose those, they're real leads. It needs to chew through a combined file of around 200k rows without eating all the RAM on my laptop. Just a simple \`python merge.py file1.csv file2.csv ... -o out.csv\` is fine.`,
    sealedExpectations: {
      ambiguitiesToClarify: [
        "What defines 'most complete'? Most non-empty fields, newest record, or a priority order between sources? When two records have the same email but different names, which wins?",
        "Does 'merge the records' mean pick one whole winning row, or fill field-by-field (name from one, phone from another)? Those produce different output.",
        "How robust must header matching be — is the 'etc' list open-ended, case-insensitive, whitespace-tolerant? What happens to a header variant you've never seen?",
      ],
      missingRequirement: {
        what: "Emails must be normalized (lowercased, trimmed) before deduping.",
        why: "Bob@X.com and bob@x.com are the same person. Deduping on the raw string keeps duplicates and defeats the entire purpose. The brief never mentions normalization, so a senior has to raise it.",
      },
      trap: {
        description: "'Dedupe on email' directly conflicts with 'rows with no email — don't lose those.' If the dedup key is email, every no-email row collapses to the same empty/null key and all but one get dropped.",
        correctResolution: "Rows without an email must bypass deduping entirely — each is kept as-is. Only rows that have an email participate in email-based dedup.",
      },
      edgeCasesToTest: [
        "Same email differing only by case or surrounding whitespace",
        "Duplicate email within a single input file",
        "Row with no email but a phone number (must survive)",
        "Row with no name (where does it sort?)",
        "Two records, same email, conflicting names (conflict resolution)",
        "A file with a header variant not in the mapping (fail loudly vs skip?)",
        "Files with a UTF-8 BOM or mixed encodings from different tools",
      ],
      designDecisionRedFlags: [
        "Deduping on the raw email string without normalization",
        "Using email as a dict key in a way that silently drops all no-email rows",
        "Reaching for a full in-memory pandas load and declaring it 'memory-safe' without thinking about the 200k constraint, or over-engineering a streaming pipeline when 200k easily fits",
      ],
    },
  },
  {
    slug: "ledger-reconciliation",
    title: "Daily ledger reconciliation script",
    domain: "Data-processing script",
    difficulty: "Hard",
    estimatedMinutes: 60,
    problemStatement: `Finance needs a reconciliation script. Every day we get a transactions export from our payment processor (CSV) and we have our own internal orders export (CSV). Match them up and flag anything that doesn't line up. Match on order_id. Amounts should match too — flag rows where the processor amount and our amount differ. One gotcha: processor amounts are in cents, ours are in dollars with two decimals. The report should have four buckets: matched, missing-from-processor, missing-from-internal, and amount-mismatches. There are refunds (negative amounts) — those are fine, just match them like everything else. Also the processor sometimes sends the same order_id twice when there was a retry on their side, so that should only count once. Files are maybe 50k rows each, runs once a day. Just email me the CSV report when it's done.`,
    sealedExpectations: {
      ambiguitiesToClarify: [
        "When the processor sends a duplicate retry, are the two rows guaranteed identical, or could a partial retry differ? Which one is authoritative?",
        "Does 'amounts should match' mean exact equality after unit conversion, or is there a tolerance? Float math (10.0 * 100) will create spurious mismatches.",
        "Is the report one CSV with all four buckets, or four files? What columns does Finance actually want?",
      ],
      missingRequirement: {
        what: "order_id is not actually a unique key — a single order can legitimately have both an original charge and a refund row with the same order_id.",
        why: "Matching purely on order_id and using it as a dict key means the refund overwrites the charge (or vice versa). The 'refunds are fine, match like normal' line quietly hides that one order_id maps to multiple legitimate rows. A senior must ask whether order_id is unique.",
      },
      trap: {
        description: "'Processor sends the same order_id twice on a retry — count once' contradicts 'refunds are fine, match like normal.' A duplicate retry and a legitimate refund both look like 'same order_id appears twice.' Naively dropping duplicate order_ids deletes real refunds.",
        correctResolution: "You can't dedup blindly on order_id. Distinguish using another signal: dedup on order_id + transaction_id, or recognize a retry as an identical-amount duplicate while a refund is a distinct (typically negative) amount. Only collapse true duplicates.",
      },
      edgeCasesToTest: [
        "Comparing $10.00 to 1000 cents without float precision errors (use integer cents or Decimal)",
        "order_id in processor but not internal, and the reverse",
        "A refund with no matching original charge",
        "A genuine duplicate-retry (identical amount) — collapse to one",
        "A 'duplicate' that's actually a refund — keep both",
        "Blank/missing amount field; amount sign mismatch",
        "Large files (50k each) — memory and join strategy",
      ],
      designDecisionRedFlags: [
        "Comparing amounts as floats directly",
        "Deduping all duplicate order_ids and silently killing refunds",
        "Treating order_id as a unique key and overwriting the charge with the refund in a dict",
      ],
    },
  },
  {
    slug: "api-client-retry",
    title: "Add retry logic to an existing API client",
    domain: "Feature in an existing module",
    difficulty: "Hard",
    estimatedMinutes: 60,
    problemStatement: `We have an \`ApiClient.fetch(url)\` method that wraps requests, and it's flaky against a vendor API — random 500s and timeouts. Add retry logic. Retry on failure, back off between attempts, and give up after a few tries by raising. Make max retries and the base delay configurable. Don't retry forever obviously. This method gets called from a few hundred places, so don't change its signature — it should just become more reliable. The vendor also rate-limits us with 429s and sometimes sends a Retry-After header. Log every retry so we can see what's going on in production. And keep it threadsafe — a pool of worker threads all share one client instance.`,
    sealedExpectations: {
      ambiguitiesToClarify: [
        "Which failures are retryable? A 400/401/404 should NOT be retried — it'll never succeed and just wastes time. Only 500/502/503/timeouts/429 are.",
        "What backoff shape — linear, exponential, with jitter? With hundreds of callers and shared threads, no jitter causes a thundering herd.",
        "How is it 'configurable' without changing the signature? Constructor args? Class attributes? Per-call kwargs?",
      ],
      missingRequirement: {
        what: "Idempotency, plus correct Retry-After parsing.",
        why: "Retrying is only safe for idempotent calls; if the client is ever used for non-idempotent requests, blind retry can double-act. And Retry-After can be either a number of seconds or an HTTP-date — both must be handled. Neither is mentioned. A total time budget (not just a count) is also worth raising.",
      },
      trap: {
        description: "'Make max retries and base delay configurable' fights 'don't change the method signature.' Adding parameters to fetch() breaks the signature that hundreds of callers depend on.",
        correctResolution: "Configuration belongs on the instance/constructor (or class attributes), not as new fetch() parameters. If optional kwargs with defaults are proposed, that's a judgment call to surface explicitly, not assume.",
      },
      edgeCasesToTest: [
        "429 with Retry-After in seconds",
        "429 with Retry-After as an HTTP-date",
        "500 then success on the next attempt",
        "Non-retryable 400/404 — must NOT retry",
        "Timeout on every attempt — raises cleanly after max",
        "Retry-After larger than your configured max backoff",
        "max_retries = 0 (no retry at all)",
        "Many threads retrying at once (jitter / thundering herd)",
      ],
      designDecisionRedFlags: [
        "Retrying all errors, including 400/404",
        "Fixed or pure-exponential backoff with no jitter under concurrency",
        "Ignoring Retry-After and using your own backoff for 429s",
        "Changing the method signature despite the explicit instruction; using a non-threadsafe shared counter",
      ],
    },
  },
  {
    slug: "image-upload-thumbnail",
    title: "Image upload + thumbnail endpoint",
    domain: "Backend service / endpoint",
    difficulty: "Hard",
    estimatedMinutes: 60,
    problemStatement: `Build an image upload endpoint. Client POSTs an image, we store the original and generate a thumbnail (say 200px wide), and return both URLs. Accept JPEG and PNG. Reject anything that isn't an image, or that's too big — cap it at 10MB. Store everything in S3, we already have a bucket. Filenames need to be unique so two uploads don't clobber each other. The thumbnail should keep aspect ratio. We'll see maybe a few uploads a second. The frontend shows a preview right after upload, so the whole thing needs to feel snappy. Some users upload HEIC straight from their iPhones — would be nice to handle that too, but ship the core thing first. Return JSON with the original URL and the thumbnail URL.`,
    sealedExpectations: {
      ambiguitiesToClarify: [
        "How are unique filenames generated — random UUID, or content hash? A content hash dedups but makes two users' identical images share a name. Do we preserve the original extension / sanitize the user's filename?",
        "Is thumbnail generation synchronous (blocks the response) or async (return original immediately, thumbnail later)? This is a real architecture fork.",
        "How do we validate 'is an image' — by extension, by Content-Type header, or by actually decoding the bytes?",
      ],
      missingRequirement: {
        what: "Real content validation and safe decoding: verify the file by its actual bytes, enforce the size cap before buffering the whole upload, and guard against decompression bombs.",
        why: "Extension/Content-Type checks are trivially spoofable, so a malicious file can claim to be a PNG. A tiny image can decompress to gigabytes when you decode it to thumbnail. These aren't optional hardening — they're correctness/security requirements a senior must raise.",
      },
      trap: {
        description: "'Feel snappy / preview right after upload' collides with synchronous thumbnail generation. Decoding + resizing + two S3 uploads before responding is not snappy at a few uploads a second.",
        correctResolution: "Either return the original URL immediately and generate the thumbnail asynchronously (frontend handles not-yet-ready), or accept the latency and define what 'snappy' means with a number. It's a decision to surface, not silently pick.",
      },
      edgeCasesToTest: [
        "File at exactly 10MB and just over",
        "Non-image with a .jpg extension (spoofed type)",
        "Corrupt or truncated image",
        "HEIC upload — explicitly in or out of scope",
        "Very tall/narrow image (200px wide → enormous height)",
        "0-byte file",
        "Decompression bomb (tiny file, huge decoded size)",
        "Two identical images (filename collision if content-hashed); PNG with transparency",
      ],
      designDecisionRedFlags: [
        "Validating type by Content-Type / extension only",
        "Buffering the entire upload into memory before checking the size cap",
        "Generating the thumbnail synchronously and calling it 'snappy' without flagging the tradeoff",
        "Using the user-supplied filename directly (clobber / path traversal)",
      ],
    },
  },
  {
    slug: "booking-availability",
    title: "Booking slot availability endpoint",
    domain: "Feature in an existing module",
    difficulty: "Hard",
    estimatedMinutes: 60,
    problemStatement: `Add an availability endpoint to our booking app. A provider sets their working hours (say 9-5) and a slot duration (say 30 min). Given a date, return the list of available start times. Subtract any slots that are already booked — we have a bookings table with start and end times. Don't return slots that are in the past. Our providers are in different cities, so this has to work across timezones. Providers can also block out times for lunch and breaks — treat those exactly like bookings. Note a single booking might be longer than one slot. We're adding this onto the existing /availability route. It needs to be fast since it's hit on basically every calendar page load. Return the list of available start times for that provider on that date.`,
    sealedExpectations: {
      ambiguitiesToClarify: [
        "'No slots in the past' — past relative to what clock? Server time, the provider's timezone, or the viewer's? With multiple timezones this genuinely matters.",
        "The 'given a date' parameter — interpreted in whose timezone? A date boundary differs by city.",
        "What if working hours don't divide evenly by the slot duration (9-5 with 45-min slots)? What happens to the remainder?",
      ],
      missingRequirement: {
        what: "Daylight-saving handling and a precise overlap definition.",
        why: "Across cities, a working day can have 23 or 25 hours on DST transition days, so naive offset/local-datetime math breaks. And 'subtract booked slots' needs 'overlap' defined — any overlap blocks the candidate slot, not just an exact start-time match. Both are unstated and decide correctness.",
      },
      trap: {
        description: "'Treat blocked times like bookings' + 'a booking might be longer than one slot' + slot-aligned generation. Lunch/blocks and bookings don't necessarily align to slot boundaries (a 12:15-12:45 block against on-the-hour slots). Removing slots whose start exactly equals a booking start misses partial overlaps and unaligned blocks.",
        correctResolution: "A candidate slot is unavailable if it overlaps ANY booking/block at all, computed with interval overlap (startA < endB AND startB < endA), never start-time equality.",
      },
      edgeCasesToTest: [
        "A booking that partially overlaps a slot",
        "A block not aligned to slot boundaries",
        "A booking longer than one slot (blocks several)",
        "Working hours not divisible by slot duration",
        "A DST transition day",
        "'Today' with the current time mid-day (past slots filtered correctly)",
        "A date in a different timezone than the provider; back-to-back bookings",
        "A booking starting before working hours / ending after",
      ],
      designDecisionRedFlags: [
        "Doing all time math in naive local datetimes with no timezone/DST awareness",
        "Removing booked slots by start-time equality instead of interval overlap",
        "Computing 'past' with server time and ignoring the provider/viewer timezone",
        "Assuming working hours divide evenly by slot duration",
      ],
    },
  },
];

async function main() {
  for (const problem of problems) {
    const p = await prisma.problem.upsert({
      where: { slug: problem.slug },
      update: problem,
      create: problem,
    });
    console.log(`Seeded: ${problem.title}`);

    await prisma.practiceSet.upsert({ where: { problemId: p.id }, update: {}, create: { problemId: p.id } });
    await prisma.testSet.upsert({ where: { problemId: p.id }, update: {}, create: { problemId: p.id } });
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
