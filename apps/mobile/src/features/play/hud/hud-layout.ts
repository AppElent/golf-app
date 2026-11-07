/**
 * Where the play HUD's layers sit, as offsets from the safe top and bottom
 * edges. They stack by hand over the canvas, so they live in one place.
 */
export const hudLayout = {
	/** Height of the top and bottom bars' main controls. */
	barMinHeight: 52,
	gpsPillTop: 64,
	distancesTop: 104,
	/** The club tray and next-tee offer, just above the bottom bar. */
	trayBottom: 64,
	/** Below the simulation banner, which takes the GPS pill's place. */
	gpsPillBelowBanner: 36,
	/** The simulation controls' two rows, above the bottom bar. */
	simulationPanel: 104,
	noMapTop: 80,
	canvasTop: 64,
	canvasBottom: 72,
	/** Clear of the front/centre/back stack on the right. */
	canvasRight: 96,
} as const;
