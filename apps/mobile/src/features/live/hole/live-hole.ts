/**
 * With "GPS while locked" off nothing would update the activity while locked,
 * so Play doesn't set a hole at all (stale distances mislead).
 *
 * iOS only, best effort: every call swallows its errors, and the module state
 * lives as long as the JS runtime does.
 */
import type { LatLng } from "@fairway/core/geo";
import { greenNumbers, type HoleAnchors } from "@fairway/core/hole-view";
import type { LiveActivity } from "expo-widgets";
import { Platform } from "react-native";
import HoleActivity, { type HoleActivityProps } from "./hole-activity";

export type LiveHole = {
	anchors: HoleAnchors;
	/** Everything but the three distances, already formatted. */
	props: Omit<HoleActivityProps, "front" | "center" | "back">;
	/** Meters → the number shown ("152"). */
	format: (meters: number) => string;
	/** Opened when the activity is tapped. */
	url: string;
	/** False for a fix away from this hole: those would mislead. */
	accepts: (position: LatLng) => boolean;
};

let hole: LiveHole | null = null;
let activity: LiveActivity<HoleActivityProps> | null = null;
let lastShown = "";
let lastHole = "";
let lastAt = 0;
let lastPosition: LatLng | null = null;
let trailing: ReturnType<typeof setTimeout> | null = null;

/** Fewer than this between updates only when the hole changes. */
const MIN_INTERVAL_MS = 2000;

const supported = () => Platform.OS === "ios";

type FixSource = "foreground" | "background";

/** The hole being played, or null to end the activity. */
export function setLiveHole(next: LiveHole | null) {
	if (!supported()) return;
	if (!next) {
		hole = null;
		// A fix from this round must not seed the next one (another course).
		lastPosition = null;
		void endActivity();
		return;
	}
	hole = next;
	if (lastPosition && next.accepts(lastPosition)) show(lastPosition, "hole");
}

export function liveHolePosition(position: LatLng, source: FixSource) {
	if (!supported()) return;
	if (hole && !hole.accepts(position)) return;
	lastPosition = position;
	if (hole) show(position, source);
}

function show(position: LatLng, trigger: FixSource | "hole") {
	const current = hole;
	if (!current) return;
	const numbers = greenNumbers(position, current.anchors);
	const props: HoleActivityProps = {
		...current.props,
		front: current.format(numbers.front),
		center: current.format(numbers.center),
		back: current.format(numbers.back),
	};
	// iOS starts activities only from the foreground.
	if (!activity && trigger === "background") return;
	const key = `${props.hole}|${props.front}|${props.center}|${props.back}`;
	const now = Date.now();
	if (key === lastShown) return;
	if (
		activity &&
		trigger !== "hole" &&
		now - lastAt < MIN_INTERVAL_MS &&
		props.hole === lastHole
	) {
		// Throttled, not dropped: the last fix still lands once the interval
		// is over, even when no newer one follows (standing at the ball).
		if (!trailing)
			trailing = setTimeout(
				() => {
					trailing = null;
					if (lastPosition) show(lastPosition, trigger);
				},
				MIN_INTERVAL_MS - (now - lastAt),
			);
		return;
	}
	lastShown = key;
	lastHole = props.hole;
	lastAt = now;
	try {
		if (activity) {
			void activity.update(props).catch(() => {});
		} else {
			// One left running by an earlier launch is taken over rather than
			// doubled.
			const existing = adopt();
			if (existing) void existing.update(props).catch(() => {});
			activity = existing ?? HoleActivity.start(props, current.url);
		}
	} catch {
		activity = null;
	}
}

/** Running activities from an earlier launch: keep the first, end the rest. */
function adopt(): LiveActivity<HoleActivityProps> | null {
	try {
		const [first, ...rest] = HoleActivity.getInstances();
		for (const extra of rest) void extra.end("immediate").catch(() => {});
		return first ?? null;
	} catch {
		return null;
	}
}

async function endActivity() {
	if (trailing) clearTimeout(trailing);
	trailing = null;
	const current = activity ?? adopt();
	activity = null;
	lastShown = "";
	lastHole = "";
	try {
		await current?.end("immediate");
	} catch {
		// Already gone.
	}
}
