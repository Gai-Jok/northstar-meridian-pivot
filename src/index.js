/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
const UPSTREAM = "https://api.chucknorris.io/jokes/random";
const ALLOWED_ORIGIN = "https://northstar-lovat-two.vercel.app";

export default {
async scheduled(controller, env, ctx) {
	console.log("cron processed");

	// 1. Call the warehouse-like API (like your Step 3 fetch, but for stock)
	const warehouseRes = await fetch("https://jsonplaceholder.typicode.com/todos/1");

	// 2. Check if it succeeded (same pattern as your Step 3 !upstreamRes.ok check)
	if (!warehouseRes.ok) {
		console.log("Warehouse fetch failed:", warehouseRes.status);
		return; // scheduled() doesn't return a Response, just stop here
	}

	// 3. Parse the JSON body
	const stockData = await warehouseRes.json();

	// 4. Pick what field(s) from stockData you want to remember
	//    (open the URL in your browser first and look at the real JSON it returns!)
	const key = "pod30_stock"; // just a name you're choosing, like a folder label
const value = JSON.stringify(stockData); // the actual data, converted to a string so KV can store it

	// 5. Write it to KV
	await env.STOCK_CACHE.put(key, value);
},
	async fetch(request, env) {
		const url = new URL(request.url);

			// --- NEW: check if this request is asking for cached stock ---
	if (url.pathname === "/stock") {
		const cached = await env.STOCK_CACHE.get("pod30_stock");

		if (!cached) {
			return Response.json({ error: "No stock data cached yet" }, { status: 404 });
		}

		// cached is currently just a STRING (that's all KV stores)
		// you need to turn it back into a real object before returning it as JSON
		const stockObj = JSON.parse(cached);

		return Response.json(stockObj);
	}

	if (url.pathname === "/checkin") {
    const attendeeId = url.searchParams.get("attendee");

    if (!attendeeId) {
        return Response.json({ error: "No attendee ID provided" }, { status: 400 });
    }

    const key = `attendee_${attendeeId}`;
    const existing = await env.ATTENDEE_CACHE.get(key);

    if (existing) {
        // someone already scanned this attendee before — what should happen here?
        const existingObj = JSON.parse(existing);
        return Response.json({ error: "Already scanned", current_status: existingObj.status }, { status: 409 });
    }
   // brand new attendee — safe to mark as pending
    const value = JSON.stringify({ status: "pending" });
    await env.ATTENDEE_CACHE.put(key, value);

    return Response.json({ attendee: attendeeId, status: "pending" });
}
if (url.pathname === "/status") {
    const attendeeId = url.searchParams.get("attendee");

    if (!attendeeId) {
        return Response.json({ error: "No attendee ID provided" }, { status: 400 });
    }

    const key = `attendee_${attendeeId}`;
    const existing = await env.ATTENDEE_CACHE.get(key);

    if (!existing) {
        return Response.json({ error: "Attendee not found" }, { status: 404 });
    }

    const existingObj = JSON.parse(existing);
    return Response.json({ attendee: attendeeId, status: existingObj.status });
}
if (url.pathname === "/webhook") {
    const attendeeId = url.searchParams.get("attendee");

    if (!attendeeId) {
        return Response.json({ error: "No attendee ID provided" }, { status: 400 });
    }

    const key = `attendee_${attendeeId}`;
    const existing = await env.ATTENDEE_CACHE.get(key, { type: "json" });

    if (!existing) {
        return Response.json({ error: "Attendee not found" }, { status: 404 });
    }

    if (existing.status === "checked_in") {
        return Response.json({ error: "Attendee already checked in" }, { status: 400 });
    }

    await env.ATTENDEE_CACHE.put(key, JSON.stringify({ status: "checked_in" }));

    return Response.json({ attendee: attendeeId, status: "checked_in" });
}

		// --- Part from Step 1/2: read your existing param ---
		const expedition = url.searchParams.get("expedition");

		// --- Part from Step 3: read the category param, build upstream URL ---
		const category = url.searchParams.get("category");
		const upstreamUrl = category
    ? `${UPSTREAM}?category=${encodeURIComponent(category)}`
    : UPSTREAM;
	try {
			// --- Step 3: call the external API ---
			const upstreamRes = await fetch(upstreamUrl, {
				headers: { Accept: "application/json" },
				cf: { cacheTtl: 0 },
			});

			if (!upstreamRes.ok) {
    return Response.json(
        { error: "Upstream error", status: upstreamRes.status },
        { status: 502 }
    );
}

			const data = await upstreamRes.json();

			// --- Merge point: combine Step 1/2's data with Step 3's data ---
			const shaped = {
				expedition: expedition || null,
				status: expedition ? "under review" : "no expedition specified",
				joke: data.value,
				category: data.categories?.[0] || "general",
				source: data.url,
			};

			return Response.json(shaped, {
				headers: {
					"Access-Control-Allow-Origin": ALLOWED_ORIGIN,
					"Cache-Control": "no-store",
				},
			});
		} 
		catch (err) {
    return Response.json(
        { error: "Failed to fetch joke" },
        { status: 500 }
    );
}
	},
};