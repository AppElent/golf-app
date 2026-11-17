/**
 * The session gate's offline fallback (APP-146): the active round's hole,
 * map and distances from the saved copy, while Convex cannot be reached on a
 * cold start. Display only: no Convex calls, scoring and marking wait for a
 * connection. Once Convex authenticates, the gate swaps in the real screens.
 */
import { effectiveBag } from "@fairway/core/club-suggest";
import { useKeepAwake } from "expo-keep-awake";
import { Component, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import {
	SafeAreaInsetsContext,
	useSafeAreaInsets,
} from "react-native-safe-area-context";
import { OfflineBanner } from "../../../convex/offline-banner";
import { useI18n } from "../../../i18n";
import { reportError } from "../../../monitoring/report";
import { course } from "../../../theme";
import { PlayHole } from "../round/play-screen";
import type { OfflineRound } from "./offline-round";

export function OfflinePlay({
	round,
	fallback,
}: {
	round: OfflineRound;
	/** Drawn instead when the copy cannot be drawn after all. */
	fallback: ReactNode;
}) {
	useKeepAwake();
	const { t } = useI18n();
	const insets = useSafeAreaInsets();
	return (
		<View style={styles.root}>
			<OfflineBanner message={t.play.offlineBanner} onCourse />
			{/* The banner already clears the status bar. */}
			<SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
				<OfflineCopyBoundary fallback={fallback}>
					<PlayHole
						key={round.active.round._id}
						active={round.active}
						detail={round.detail}
						bag={effectiveBag(round.clubs)}
						units={round.units}
						offline
					/>
				</OfflineCopyBoundary>
			</SafeAreaInsetsContext.Provider>
		</View>
	);
}

/** A copy that throws while drawing is a missing copy, never a crash. */
class OfflineCopyBoundary extends Component<
	{ fallback: ReactNode; children: ReactNode },
	{ failed: boolean }
> {
	state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	componentDidCatch(error: unknown) {
		reportError(error);
	}
	render() {
		return this.state.failed ? this.props.fallback : this.props.children;
	}
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: course.rough },
});
