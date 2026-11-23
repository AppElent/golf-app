import { httpRouter } from "convex/server";
import { Webhook } from "svix";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

/**
 * Clerk webhooks. All AppElent apps share one Clerk login, so a login deleted
 * anywhere (another app, the Clerk dashboard) arrives here as `user.deleted`,
 * and Fairway deletes that person's data with the same purge as in-app
 * deletion (`account.purgeDeletedUser`). Svix signs every delivery with
 * `CLERK_WEBHOOK_SECRET`; anything unsigned or badly signed is refused before
 * any work. Other event types are acknowledged and ignored.
 */
const clerkWebhook = httpAction(async (ctx, request) => {
	const secret = process.env.CLERK_WEBHOOK_SECRET;
	if (!secret) {
		console.error("CLERK_WEBHOOK_SECRET is not set; refusing Clerk webhook.");
		return new Response("Webhook not configured", { status: 500 });
	}
	const payload = await request.text();
	try {
		// Throws on a missing, wrong or stale (over five minutes) signature.
		new Webhook(secret).verify(payload, {
			"svix-id": request.headers.get("svix-id") ?? "",
			"svix-timestamp": request.headers.get("svix-timestamp") ?? "",
			"svix-signature": request.headers.get("svix-signature") ?? "",
		});
	} catch {
		return new Response("Invalid signature", { status: 401 });
	}
	let event: unknown;
	try {
		event = JSON.parse(payload);
	} catch {
		return new Response("Invalid payload", { status: 400 });
	}
	const subject = deletedUserId(event);
	if (subject) {
		await ctx.runMutation(internal.account.purgeDeletedUser, { subject });
	}
	return new Response(null, { status: 200 });
});

/** The Clerk user id of a `user.deleted` event, or null for anything else. */
function deletedUserId(event: unknown): string | null {
	if (typeof event !== "object" || event === null) return null;
	const { type, data } = event as { type?: unknown; data?: { id?: unknown } };
	if (type !== "user.deleted") return null;
	const id = data?.id;
	return typeof id === "string" && id.length > 0 ? id : null;
}

const http = httpRouter();

http.route({ path: "/clerk/webhook", method: "POST", handler: clerkWebhook });

export default http;
