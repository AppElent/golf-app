import type { ModalProps } from "react-native";
// The one place that may render React Native's Modal: every modal goes through
// here so a shake never opens the feedback form underneath it.
// biome-ignore lint/style/noRestrictedImports: this is the wrapper.
import { Modal as NativeModal } from "react-native";
import { useShakeToReportBlocker } from "../monitoring/shake-to-report";

/** React Native's `Modal`, pausing shake-to-report while it is visible. */
export function Modal(props: ModalProps) {
	useShakeToReportBlocker(props.visible !== false);
	return <NativeModal {...props} />;
}
