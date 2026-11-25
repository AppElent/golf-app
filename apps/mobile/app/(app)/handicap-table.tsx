import { useLocalSearchParams } from "expo-router";
import { parseSetupParam } from "../../src/features/rounds/handicap-table/handicap-table-params";
import { HandicapTableScreen } from "../../src/features/rounds/handicap-table/handicap-table-screen";

export default function HandicapTableRoute() {
	const { setup, hole } = useLocalSearchParams<{
		setup?: string;
		hole?: string;
	}>();
	return <HandicapTableScreen setup={parseSetupParam(setup)} hole={hole} />;
}
