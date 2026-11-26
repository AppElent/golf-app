/** Home, course picker and round setup. */
export const homeEn = {
	title: "Fairway",
	handicap: "Handicap index",
	handicapUnset: "Not set",
	handicapUnsetHint: "Add it for your playing handicap and net scores.",
	wouldBe: "Would-be index {value}",
	wouldBeHint: "From your last {count} rounds",
	startRound: "Start round",
	resumeTitle: "Round in progress",
	resumeSimulation: "Simulation — not saved",
	resume: "Resume",
	resumeDetail: "Hole {hole} · {n} of {total} played",
	handicapEdit: "Opens your handicap index",
	recentRounds: "Recent rounds",
	allRounds: "All rounds",
	nineHoles: "9 holes",
	noRounds: "No rounds yet",
	noRoundsHint: "Your finished rounds show up here.",
	updateReady: "Update ready",
	updateReadyHint: "Tap to restart Fairway with the new version.",
	startNewRound: "Start a new round",
	newRoundTitle: "Round in progress",
	newRoundMessage:
		"{course}, {n} of {total} played. Resume it, or stop it to start a new round. Stopping deletes its scores.",
	stopRound: "Stop round",
	stopError: "Could not stop the round.",
	inProgressTitle: "A round is in progress",
	inProgressBody:
		"Finish or stop your round at {course} before you start another.",
	resumeRound: "Resume round",
};

export const homeNl: typeof homeEn = {
	title: "Fairway",
	handicap: "Handicap",
	handicapUnset: "Niet ingesteld",
	handicapUnsetHint: "Vul hem in voor je baanhandicap en nettoscores.",
	wouldBe: "Indicatieve handicap {value}",
	wouldBeHint: "Uit je laatste {count} rondes",
	startRound: "Ronde starten",
	resumeTitle: "Ronde bezig",
	resumeSimulation: "Simulatie — niet opgeslagen",
	resume: "Hervatten",
	resumeDetail: "Hole {hole} · {n} van {total} gespeeld",
	handicapEdit: "Opent je handicapindex",
	recentRounds: "Recente rondes",
	allRounds: "Alle rondes",
	nineHoles: "9 holes",
	noRounds: "Nog geen rondes",
	noRoundsHint: "Je afgeronde rondes verschijnen hier.",
	updateReady: "Update klaar",
	updateReadyHint: "Tik om Fairway met de nieuwe versie te herstarten.",
	startNewRound: "Nieuwe ronde starten",
	newRoundTitle: "Ronde bezig",
	newRoundMessage:
		"{course}, {n} van {total} gespeeld. Hervat hem, of stop hem om een nieuwe ronde te starten. Stoppen verwijdert de scores.",
	stopRound: "Ronde stoppen",
	stopError: "De ronde kon niet worden gestopt.",
	inProgressTitle: "Er loopt al een ronde",
	inProgressBody:
		"Rond je ronde op {course} af of stop hem voordat je een nieuwe start.",
	resumeRound: "Ronde hervatten",
};

export const coursesEn = {
	title: "Choose course",
	search: "Search courses",
	nearby: "Nearby",
	all: "All courses",
	home: "Home course",
	locating: "Finding courses near you…",
	locationOff: "Turn on location to sort courses by distance.",
	allowLocation: "Allow location",
	locationUnavailable: "Could not find your location.",
	noMatch: "No courses match “{query}”.",
	empty: "No courses yet",
	emptyHint: "Import a course on the web app first.",
};

export const coursesNl: typeof coursesEn = {
	title: "Kies baan",
	search: "Zoek banen",
	nearby: "In de buurt",
	all: "Alle banen",
	home: "Thuisbaan",
	locating: "Banen in de buurt zoeken…",
	locationOff: "Zet locatie aan om banen op afstand te sorteren.",
	allowLocation: "Locatie toestaan",
	locationUnavailable: "Je locatie kon niet worden bepaald.",
	noMatch: "Geen banen gevonden voor “{query}”.",
	empty: "Nog geen banen",
	emptyHint: "Importeer eerst een baan via de webapp.",
};

export const setupEn = {
	holes: "Holes",
	holesHint:
		"Pick one loop for 9 holes, two for 18. The same loop twice is fine.",
	holesAgain: "Tap a loop again to play it twice.",
	loop: "Holes {label}",
	loopPar: "Par {par}",
	loopParTwice: "Par {par} · ×2",
	/** Two different loops: which one is played first. */
	loopParOrder: { 1: "Par {par} · first", 2: "Par {par} · second" },
	loopTwice: "{loop} twice · par {par}",
	holeCount: "{count} holes · par {par}",
	incomplete:
		"Holes {holes} are missing par or stroke index. Complete them on the web first.",
	tee: "Tee",
	teeDetail: "CR {cr} · slope {slope}",
	format: "Format",
	formats: {
		stableford: { title: "Stableford", detail: "Points per hole" },
		stroke: { title: "Stroke play", detail: "Total strokes" },
		match: { title: "Match play", detail: "2 players" },
		skins: { title: "Skins", detail: "2–4 players" },
		sixes: { title: "Sixes", detail: "Exactly 3 players" },
		scramble: { title: "Texas Scramble", detail: "Teams · 2–4 players" },
	},
	needsExactly: "{formats}: only with exactly {n} players.",
	needsRange: "{formats}: only with {min} to {max} players.",
	/** On a format tile that can't be chosen. */
	tileExactly: "Only with {n} players",
	tileRange: "Only with {min}–{max} players",
	playersNow: { one: "You have {count} now.", other: "You have {count} now." },
	scoring: "Score",
	teams: "Teams",
	teamChoice: { one: "1 team", other: "{count} teams" },
	matchStrokes: {
		one: "{name} gets {count} stroke.",
		other: "{name} gets {count} strokes.",
	},
	matchStrokesOn: {
		one: "{name} gets 1 stroke: on the hole with HCP 1.",
		other:
			"{name} gets {count} strokes: one on every hole with HCP 1 to {count}.",
	},
	matchLevel: "Nobody gets strokes.",
	matchCounts: "Strokes still count for your score and handicap.",
	noStrokes: "Without handicap strokes.",
	carryOver: "Carry over ties",
	carryOverFooter: "A tied skin goes to the next hole. Off: nobody gets it.",
	sixesFooter:
		"Every hole shares 6 points: 4 · 2 · 0. Tied for best: 3 · 3 · 0. Tied for second: 4 · 1 · 1. All three tied: 2 · 2 · 2. Net counts everyone's own handicap strokes.",
	teamTap: "Tap a player to move them to the other team.",
	teamHandicap:
		"Team handicap: {share} of the playing handicaps, lowest first.",
	teamHandicapTwo:
		"Team handicap: 35% of the lowest plus 15% of the highest playing handicap.",
	twoTeamsNeed: "Two teams need four players.",
	scrambleCounts: "A scramble doesn't count toward your handicap or stats.",
	moveTo: "Moves to {team}",
	players: "Players",
	you: "You",
	guest: "Guest {n}",
	guestName: "Name",
	handicapIndex: "Handicap index",
	index: "HCP {index}",
	noIndex: "No handicap · gross",
	ownerDetail: "You · {detail}",
	plays: "plays {value}",
	addGuest: "Add player",
	playingFrom: "Playing handicap from the {tee} tee, {count} holes.",
	playerTitle: "Player",
	playerHandicap: "Handicap",
	playerPlays: "Plays {value} from the {tee} tee.",
	playerBlank: "Leave blank for no handicap (gross).",
	removePlayer: "Remove player",
	start: "Tee off",
	startSimulation: "Start simulation",
	simulationNote:
		"A simulated round: nothing counts for your history, stats or handicap.",
	startError: "Could not start the round.",
	notFound: "Course not found.",
	noTees: "This course has no tees yet. Add one on the web first.",
	myCopy: "My copy",
	suggest: "Suggest a correction",
};

export const suggestEn = {
	title: "Suggest a correction",
	label: "What's wrong?",
	placeholder: "For example: hole 7 is par 4 on the 2025 scorecard.",
	footer:
		"Course data is checked against the club's scorecard and is the same for everyone. We review every suggestion.",
	send: "Send",
	sent: "Thanks — we'll check it.",
	error: "Couldn't send your suggestion.",
};

export const setupNl: typeof setupEn = {
	holes: "Holes",
	holesHint:
		"Kies één lus voor 9 holes, twee voor 18. Twee keer dezelfde lus mag.",
	holesAgain: "Tik nog eens op een lus om hem twee keer te spelen.",
	loop: "Holes {label}",
	loopPar: "Par {par}",
	loopParTwice: "Par {par} · ×2",
	loopParOrder: { 1: "Par {par} · eerst", 2: "Par {par} · daarna" },
	loopTwice: "{loop} twee keer · par {par}",
	holeCount: "{count} holes · par {par}",
	incomplete:
		"Bij holes {holes} ontbreekt par of strokeindex. Vul ze eerst aan op het web.",
	tee: "Tee",
	teeDetail: "CR {cr} · slope {slope}",
	format: "Spelvorm",
	formats: {
		stableford: { title: "Stableford", detail: "Punten per hole" },
		stroke: { title: "Strokeplay", detail: "Totaal slagen" },
		match: { title: "Matchplay", detail: "2 spelers" },
		skins: { title: "Skins", detail: "2–4 spelers" },
		sixes: { title: "Zessen", detail: "Precies 3 spelers" },
		scramble: { title: "Texas Scramble", detail: "Teams · 2–4 spelers" },
	},
	needsExactly: "{formats}: alleen met precies {n} spelers.",
	needsRange: "{formats}: alleen met {min} tot {max} spelers.",
	tileExactly: "Alleen met {n} spelers",
	tileRange: "Alleen met {min}–{max} spelers",
	playersNow: {
		one: "Je hebt er nu {count}.",
		other: "Je hebt er nu {count}.",
	},
	scoring: "Score",
	teams: "Teams",
	teamChoice: { one: "1 team", other: "{count} teams" },
	matchStrokes: {
		one: "{name} krijgt {count} slag.",
		other: "{name} krijgt {count} slagen.",
	},
	matchStrokesOn: {
		one: "{name} krijgt 1 slag: op de hole met HCP 1.",
		other:
			"{name} krijgt {count} slagen: één op elke hole met HCP 1 t/m {count}.",
	},
	matchLevel: "Niemand krijgt slagen.",
	matchCounts: "Slagen tellen ook gewoon mee voor je score en handicap.",
	noStrokes: "Zonder handicapslagen.",
	carryOver: "Doorschuiven bij gelijkspel",
	carryOverFooter:
		"Bij gelijkspel gaat de skin naar de volgende hole. Uit: niemand krijgt hem.",
	sixesFooter:
		"Elke hole verdeelt 6 punten: 4 · 2 · 0. Gelijk voor de beste: 3 · 3 · 0. Gelijk voor de tweede: 4 · 1 · 1. Alle drie gelijk: 2 · 2 · 2. Netto telt ieders eigen handicapslagen.",
	teamTap: "Tik op een speler om hem naar het andere team te zetten.",
	teamHandicap:
		"Teamhandicap: {share} van de speelhandicaps, van laag naar hoog.",
	teamHandicapTwo:
		"Teamhandicap: 35% van de laagste plus 15% van de hoogste speelhandicap.",
	twoTeamsNeed: "Twee teams kan met vier spelers.",
	scrambleCounts:
		"Een scramble telt niet mee voor je handicap en statistieken.",
	moveTo: "Gaat naar {team}",
	players: "Spelers",
	you: "Jij",
	guest: "Gast {n}",
	guestName: "Naam",
	handicapIndex: "Handicapindex",
	index: "HCP {index}",
	noIndex: "Geen handicap · bruto",
	ownerDetail: "Jij · {detail}",
	plays: "speelt {value}",
	addGuest: "Speler toevoegen",
	playingFrom: "Speelhandicap van tee {tee}, {count} holes.",
	playerTitle: "Speler",
	playerHandicap: "Handicap",
	playerPlays: "Speelt {value} van tee {tee}.",
	playerBlank: "Leeg laten = geen handicap (bruto).",
	removePlayer: "Speler verwijderen",
	start: "Afslaan",
	startSimulation: "Simulatie starten",
	simulationNote:
		"Een gesimuleerde ronde: niets telt mee voor je historie, statistieken of handicap.",
	startError: "De ronde kon niet worden gestart.",
	notFound: "Baan niet gevonden.",
	noTees: "Deze baan heeft nog geen tees. Voeg er eerst een toe op het web.",
	myCopy: "Mijn kopie",
	suggest: "Correctie voorstellen",
};

export const suggestNl: typeof suggestEn = {
	title: "Correctie voorstellen",
	label: "Wat klopt er niet?",
	placeholder: "Bijvoorbeeld: hole 7 is par 4 op de scorekaart van 2025.",
	footer:
		"Baangegevens worden gecontroleerd met de scorekaart van de club en zijn voor iedereen gelijk. We bekijken elk voorstel.",
	send: "Versturen",
	sent: "Bedankt — we kijken ernaar.",
	error: "Je voorstel kon niet worden verstuurd.",
};

export const simulatorEn = {
	title: "Course simulator",
	intro:
		"Test a course from anywhere: stand wherever you like and play through its holes. Your real round, history, stats and handicap stay untouched.",
	running: "Simulation in progress",
	resume: "Resume",
	pickCourse: "Start on a course",
	ended: "Simulation ended, nothing saved",
	paused:
		"Simulation paused, nothing saved. Resume it from the course simulator.",
};

export const simulatorNl: typeof simulatorEn = {
	title: "Baansimulator",
	intro:
		"Test een baan vanaf elke plek: ga staan waar je wilt en speel de holes door. Je echte ronde, historie, statistieken en handicap blijven ongemoeid.",
	running: "Simulatie bezig",
	resume: "Hervatten",
	pickCourse: "Starten op een baan",
	ended: "Simulatie beëindigd, niets opgeslagen",
	paused:
		"Simulatie gepauzeerd, niets opgeslagen. Hervat hem in de baansimulator.",
};
