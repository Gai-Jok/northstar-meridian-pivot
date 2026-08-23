# Northstar Meridian Pivot

A one-week solo simulation built on Cloudflare Workers, covering independent learning of a genuinely unfamiliar tool (serverless functions, Cron Triggers, Workers KV) and a non-negotiable mid-sprint pivot from a synchronous to an asynchronous integration model.

**Live deployment:** https://my-first-worker.gaijok57.workers.dev/

## Scenario Recap

- **Days 1–2 (solo recon):** learned Cloudflare Workers from scratch — request/response handling, JSON responses, calling an external API, and error handling.
- **Day 3 (original spec — Northstar Retail Co.):** built a polling + caching + query pipeline — a Cron Trigger polls a stand-in "warehouse" API every 5 minutes, caches the result in Workers KV, and a query endpoint (`/stock`) serves the cached value.
- **Day 4 (the pivot — Solstice Events Co.):** the badge-printer vendor's synchronous print API was deprecated with no extension. The kiosk check-in flow was rebuilt around an asynchronous model: a check-in creates a `pending` record, and a separate webhook confirms completion, flipping the record to `checked_in`. Duplicate-scan protection holds under this new model even though confirmations may arrive out of order.

Full write-ups of this process live in the accompanying **Learning & Blocker Journal** and **Scope Delta Analysis** documents submitted alongside this repo.

## Project Structure

```
src/index.js       — the Worker: scheduled handler + all fetch routes
wrangler.jsonc      — Worker config: cron schedule, KV namespace bindings
```

## Routes

| Route | Method | Purpose |
|---|---|---|
| `/` | GET | Original solo-recon demo: reads an `expedition` query param, calls the Chuck Norris API, returns a shaped JSON response combining both. |
| `/stock` | GET | Day 3 query endpoint. Returns the most recently cron-cached "warehouse stock" data from KV. |
| `/checkin?attendee=<id>` | GET | Day 4 (post-pivot). Creates a `pending` record for a new attendee. Returns `409` if that attendee already has any record (pending or checked in). |
| `/webhook?attendee=<id>` | GET | Day 4 (post-pivot). Simulates the vendor's asynchronous print-confirmation callback. Flips a `pending` attendee to `checked_in`. Returns `404` if the attendee has no record, or `400` if already checked in. |
| `/status?attendee=<id>` | GET | Day 4 (post-pivot). Read-only lookup of an attendee's current status, added to verify state transitions without side effects. |

## Example Test Sequence (Day 4 pivot)

```
GET /checkin?attendee=A123      → { "attendee": "A123", "status": "pending" }
GET /webhook?attendee=A123      → { "attendee": "A123", "status": "checked_in" }
GET /status?attendee=A123       → { "attendee": "A123", "status": "checked_in" }
GET /checkin?attendee=A123      → 409 { "error": "Already scanned", "current_status": "checked_in" }
GET /webhook?attendee=A123      → 400 { "error": "Attendee already checked in" }
```

This sequence (new check-in → webhook confirmation → status check → duplicate check-in → duplicate webhook) was run against four separate attendees during testing; results are recorded in full in the Scope Delta Analysis document.

## Notable Design Notes / Trade-offs

- **KV eventual consistency:** Workers KV writes can take a short time to propagate across edge locations. A single stale read was observed during testing immediately after a status change; a follow-up request confirmed the correct value. This is a known trade-off of the asynchronous, distributed-storage model and is documented in the Scope Delta Analysis rather than treated as a defect.
- **Simulated vendor queue:** the badge-printer vendor's message queue is simulated by directly calling `/webhook` rather than through a real managed queue (e.g., Cloudflare Queues), due to the sprint's time constraints.
- **Shared runtime:** the Day 1–3 practice routes (`/`, `/stock`) and the Day 4 pivot routes (`/checkin`, `/webhook`, `/status`) intentionally coexist in the same Worker to show the full progression of the sprint in one deployable artifact.

## Running Locally

```bash
npm install
npm run dev
```

## Deploying

```bash
npm run deploy
```

Requires a Cloudflare account with two KV namespaces bound in `wrangler.jsonc`: `STOCK_CACHE` and `ATTENDEE_CACHE`.
