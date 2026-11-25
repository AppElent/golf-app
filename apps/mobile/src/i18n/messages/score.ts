/** The score sheet, the scorecard and the handicap table. */
export const scoreEn = {
	title: "Hole {n}",
	strokes: "Strokes",
	putts: "Putts",
	penalties: "Penalties",
	bunker: "Bunker",
	yes: "Yes",
	no: "No",
	teeShot: "Tee shot",
	teeShots: { left: "Left", fairway: "Fairway", right: "Right" },
	flight: "Flight",
	results: {
		albatross: "Albatross",
		eagle: "Eagle",
		birdie: "Birdie",
		par: "Par",
		bogey: "Bogey",
		double: "Double bogey",
		triple: "Triple bogey",
	},
	points: "{n} pt",
	net: "net {n}",
	/** Handicap strokes on this hole: "+1 stroke". */
	strokesReceived: {
		one: "{sign}{count} stroke",
		other: "{sign}{count} strokes",
	},
	more: "More",
	otherFor: "Other score or picked up for {name}",
	pickedUp: "Picked up",
	undoPickedUp: "Not picked up",
	pickedUpHint: "Long press: picked up, no score on this hole",
	save: "Save",
	saving: "Saving…",
	saveError: "Score not saved. Check your connection and try again.",
	strokesFor: "Strokes for {name}",
	noRound: "This round has finished.",
};

export const scorecardEn = {
	title: "Scorecard",
	hole: "Hole",
	par: "Par",
	out: "Out",
	in: "In",
	total: "Total",
	points: "{n} pts",
	finish: "Finish round",
	finishTitle: "Finish this round?",
	finishMessage: "Totals and your handicap differential are stored.",
	finishSimulationMessage: "This ends the simulation. Nothing is saved.",
	finishSimulationMissing: {
		one: "{count} hole has no score.",
		other: "{count} holes have no score.",
	},
	finishMissing: {
		one: "{count} hole has no score for you. It counts as not played.",
		other: "{count} holes have no score for you. They count as not played.",
	},
	finishTeamMessage:
		"Totals are stored. A scramble doesn't count toward your handicap or stats.",
	finishTeamMissing: {
		one: "{count} hole is missing a team score. It counts as not played.",
		other: "{count} holes are missing a team score. They count as not played.",
	},
	finishError: "Could not finish the round. Check your connection.",
	abandon: "Abandon round",
	abandonTitle: "Abandon this round?",
	abandonMessage: "The round and all its scores are deleted.",
	abandonError: "Could not abandon the round. Check your connection.",
	editHole: "Edit hole {n}",
	missing: "{name}: no score",
};

export const handicapTableEn = {
	title: "Strokes per hole",
	subtitle: "Tee {tee} · {count} holes",
	strokeIndex: "HCP",
	strokes: { one: "{count} stroke", other: "{count} strokes" },
	givesBack: {
		one: "gives {count} stroke back",
		other: "gives {count} strokes back",
	},
	footer:
		"● = one extra stroke on that hole. Stableford and net scores use this.",
	noStrokeIndexes: "This course has no stroke index per hole.",
};

export const scoreNl: typeof scoreEn = {
	title: "Hole {n}",
	strokes: "Slagen",
	putts: "Putts",
	penalties: "Straf",
	bunker: "Bunker",
	yes: "Ja",
	no: "Nee",
	teeShot: "Afslag",
	teeShots: { left: "Links", fairway: "Fairway", right: "Rechts" },
	flight: "Flight",
	results: {
		albatross: "Albatros",
		eagle: "Eagle",
		birdie: "Birdie",
		par: "Par",
		bogey: "Bogey",
		double: "Dubbel bogey",
		triple: "Tripel bogey",
	},
	points: "{n} pt",
	net: "netto {n}",
	strokesReceived: { one: "{sign}{count} slag", other: "{sign}{count} slagen" },
	more: "Meer",
	otherFor: "Andere score of opgeraapt voor {name}",
	pickedUp: "Opgeraapt",
	undoPickedUp: "Niet opgeraapt",
	pickedUpHint: "Lang indrukken: opgeraapt, geen score op deze hole",
	save: "Opslaan",
	saving: "Opslaan…",
	saveError:
		"Score niet opgeslagen. Controleer je verbinding en probeer opnieuw.",
	strokesFor: "Slagen voor {name}",
	noRound: "Deze ronde is afgelopen.",
};

export const scorecardNl: typeof scorecardEn = {
	title: "Scorekaart",
	hole: "Hole",
	par: "Par",
	out: "Uit",
	in: "In",
	total: "Totaal",
	points: "{n} ptn",
	finish: "Ronde afronden",
	finishTitle: "Deze ronde afronden?",
	finishMessage: "Totalen en je handicapdifferential worden opgeslagen.",
	finishSimulationMessage:
		"Hiermee stopt de simulatie. Er wordt niets opgeslagen.",
	finishSimulationMissing: {
		one: "{count} hole heeft geen score.",
		other: "{count} holes hebben geen score.",
	},
	finishMissing: {
		one: "{count} hole heeft geen score van jou. Die telt als niet gespeeld.",
		other:
			"{count} holes hebben geen score van jou. Die tellen als niet gespeeld.",
	},
	finishTeamMessage:
		"De totalen worden opgeslagen. Een scramble telt niet mee voor je handicap en statistieken.",
	finishTeamMissing: {
		one: "Op {count} hole ontbreekt een teamscore. Die telt als niet gespeeld.",
		other:
			"Op {count} holes ontbreekt een teamscore. Die tellen als niet gespeeld.",
	},
	finishError: "Ronde afronden mislukt. Controleer je verbinding.",
	abandon: "Ronde stoppen",
	abandonTitle: "Deze ronde stoppen?",
	abandonMessage: "De ronde en alle scores worden verwijderd.",
	abandonError: "Ronde stoppen mislukt. Controleer je verbinding.",
	editHole: "Hole {n} bewerken",
	missing: "{name}: geen score",
};

export const handicapTableNl: typeof handicapTableEn = {
	title: "Slagen per hole",
	subtitle: "Tee {tee} · {count} holes",
	strokeIndex: "HCP",
	strokes: { one: "{count} slag", other: "{count} slagen" },
	givesBack: {
		one: "geeft {count} slag terug",
		other: "geeft {count} slagen terug",
	},
	footer:
		"● = één slag extra op die hole. Stableford en netto scores rekenen hiermee.",
	noStrokeIndexes: "Deze baan heeft geen handicapvolgorde per hole.",
};
