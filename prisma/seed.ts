import "dotenv/config";
import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient } from "../generated/prisma/client";
import { applyConstraints } from "./apply-constraints";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	throw new Error("DATABASE_URL is required to run the seed");
}

const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

const COUNTS = {
	librarians: 2,
	members: 250,
	authors: 400,
	publishers: 50,
	genres: 20,
	works: 800,
	maxEditionsPerWork: 4,
	reservations: 60,
} as const;

const PASSWORD = "12341234";
const LOAN_DAYS = 14;
const BATCH = 500;

const FIRST_NAMES = [
	"Anna",
	"Piotr",
	"Maria",
	"Jan",
	"Katarzyna",
	"Tomasz",
	"Agnieszka",
	"Michał",
	"Magdalena",
	"Krzysztof",
	"Joanna",
	"Paweł",
	"Aleksandra",
	"Marcin",
	"Ewa",
	"Andrzej",
	"Natalia",
	"Łukasz",
	"Barbara",
	"Jakub",
	"Monika",
	"Mateusz",
	"Zofia",
	"Adam",
	"Julia",
	"Wojciech",
	"Karolina",
	"Grzegorz",
	"Aleksander",
	"Iwona",
];

const LAST_NAMES = [
	"Nowak",
	"Kowalski",
	"Wiśniewski",
	"Wójcik",
	"Kowalczyk",
	"Kamiński",
	"Lewandowski",
	"Zieliński",
	"Szymański",
	"Woźniak",
	"Dąbrowski",
	"Kozłowski",
	"Jankowski",
	"Mazur",
	"Kwiatkowski",
	"Krawczyk",
	"Piotrowski",
	"Grabowski",
	"Nowakowski",
	"Pawłowski",
	"Michalski",
	"Nowicki",
	"Adamczyk",
	"Dudek",
	"Zając",
	"Wieczorek",
	"Jabłoński",
	"Król",
	"Majewski",
	"Olszewski",
];

const PUBLISHER_NAMES = [
	"Wydawnictwo Literackie",
	"Znak",
	"Czarne",
	"W.A.B.",
	"Rebis",
	"Prószyński i S-ka",
	"Świat Książki",
	"Albatros",
	"Muza",
	"PWN",
	"Ossolineum",
	"Czytelnik",
	"Iskry",
	"Książka i Wiedza",
	"Nasza Księgarnia",
	"Egmont",
	"Powergraph",
	"Mag",
	"Fabryka Słów",
	"SQN",
	"Insignis",
	"Otwarte",
	"Agora",
	"Czerwone i Czarne",
	"Dowody na Istnienie",
	"Karakter",
	"Lokator",
	"Nisza",
	"ArtRage",
	"BookRage",
	"Sonia Draga",
	"Jaguar",
	"Wilga",
	"Zielona Sowa",
	"Bellona",
	"RM",
	"Pascal",
	"Olesiejuk",
	"Edipresse",
	"Bauer",
	"Publicat",
	"Wydawnictwo Uniwersytetu Wrocławskiego",
	"Universitas",
	"Austeria",
	"Ha!art",
	"Krytyka Polityczna",
	"Czarna Owca",
	"Wydawnictwo Dolnośląskie",
	"Helion",
	"Onepress",
];

const GENRE_NAMES = [
	"Powieść",
	"Kryminał",
	"Fantastyka",
	"Science fiction",
	"Romans",
	"Biografia",
	"Historia",
	"Popularnonaukowa",
	"Dla dzieci",
	"Dla młodzieży",
	"Poezja",
	"Dramat",
	"Esej",
	"Reportaż",
	"Thriller",
	"Horror",
	"Przygodowa",
	"Publicystyka",
	"Filozofia",
	"Informatyka",
];

/** Słownik krajów: kody ISO 3166-1 alpha-2. */
const COUNTRIES = [
	{ code: "PL", name: "Polska" },
	{ code: "GB", name: "Wielka Brytania" },
	{ code: "US", name: "Stany Zjednoczone" },
	{ code: "DE", name: "Niemcy" },
	{ code: "AT", name: "Austria" },
	{ code: "FR", name: "Francja" },
	{ code: "BE", name: "Belgia" },
	{ code: "RU", name: "Rosja" },
	{ code: "UA", name: "Ukraina" },
	{ code: "ES", name: "Hiszpania" },
	{ code: "AR", name: "Argentyna" },
	{ code: "IT", name: "Włochy" },
	{ code: "CZ", name: "Czechy" },
	{ code: "SE", name: "Szwecja" },
	{ code: "NO", name: "Norwegia" },
	{ code: "JP", name: "Japonia" },
	{ code: "CA", name: "Kanada" },
	{ code: "IE", name: "Irlandia" },
] as const;

/** Słownik języków: kody ISO 639-1. */
const LANGUAGES = [
	{ code: "pl", name: "polski" },
	{ code: "en", name: "angielski" },
	{ code: "de", name: "niemiecki" },
	{ code: "fr", name: "francuski" },
	{ code: "ru", name: "rosyjski" },
	{ code: "uk", name: "ukraiński" },
	{ code: "es", name: "hiszpański" },
	{ code: "it", name: "włoski" },
	{ code: "cs", name: "czeski" },
	{ code: "sv", name: "szwedzki" },
	{ code: "no", name: "norweski" },
	{ code: "ja", name: "japoński" },
] as const;

type LanguageCode = (typeof LANGUAGES)[number]["code"];
type CountryCode = (typeof COUNTRIES)[number]["code"];

/** Kraj pochodzenia autora piszącego w danym języku. */
const COUNTRIES_BY_LANGUAGE: Record<LanguageCode, readonly CountryCode[]> = {
	pl: ["PL"],
	en: ["GB", "US", "CA", "IE"],
	de: ["DE", "AT"],
	fr: ["FR", "BE"],
	ru: ["RU"],
	uk: ["UA"],
	es: ["ES", "AR"],
	it: ["IT"],
	cs: ["CZ"],
	sv: ["SE"],
	no: ["NO"],
	ja: ["JP"],
};

/** Słowa do budowy tytułów oryginalnych przekładów: [przymiotniki, rzeczowniki]. */
const ORIGINAL_TITLE_WORDS: Record<
	Exclude<LanguageCode, "pl">,
	readonly [readonly string[], readonly string[]]
> = {
	en: [
		["The Silent", "The Lost", "The Last", "The Hidden", "The Golden"],
		["Garden", "Bridge", "House", "Key", "Shadow", "City"],
	],
	de: [
		["Der stille", "Der letzte", "Der verborgene", "Der goldene"],
		["Garten", "Wald", "Schlüssel", "Schatten", "Traum"],
	],
	fr: [
		["Le jardin", "La maison", "Le pont", "La clé", "L'ombre"],
		["perdu", "oublié", "secret", "silencieux", "doré"],
	],
	ru: [
		["Тихий", "Последний", "Забытый", "Золотой"],
		["сад", "дом", "мост", "ключ", "город"],
	],
	uk: [
		["Тихий", "Останній", "Забутий", "Золотий"],
		["сад", "дім", "міст", "ключ", "ліс"],
	],
	es: [
		["El jardín", "La casa", "El puente", "La llave", "La sombra"],
		["perdido", "olvidado", "secreto", "dorado"],
	],
	it: [
		["Il giardino", "La casa", "Il ponte", "La chiave", "L'ombra"],
		["perduto", "segreto", "dorato", "dimenticato"],
	],
	cs: [
		["Tichá", "Poslední", "Ztracená", "Zlatá"],
		["zahrada", "cesta", "řeka", "noc"],
	],
	sv: [
		["Den tysta", "Den sista", "Den gömda", "Den gyllene"],
		["trädgården", "bron", "nyckeln", "skuggan"],
	],
	no: [
		["Den stille", "Den siste", "Den skjulte", "Den gylne"],
		["hagen", "broen", "nøkkelen", "skyggen"],
	],
	ja: [
		["Shizuka na", "Saigo no", "Kakureta", "Kin'iro no"],
		["niwa", "hashi", "ie", "kage", "yume"],
	],
};

const DESCRIPTION_TEMPLATES = [
	(noun: string) =>
		`Wielowątkowa opowieść, w której ${noun} staje się świadkiem losów kilku pokoleń jednej rodziny.`,
	(noun: string) =>
		`Kameralna historia o pamięci, stracie i powrotach. Motywem przewodnim jest ${noun}.`,
	(noun: string) =>
		`Trzymająca w napięciu fabuła, w której ${noun} skrywa tajemnicę sprzed lat.`,
	(noun: string) =>
		`Zbiór obserwacji i refleksji, dla których punktem wyjścia jest ${noun}.`,
	(noun: string) =>
		`Książka o dorastaniu i wyborach, które zmieniają wszystko — a ${noun} jest ich cichym tłem.`,
] as const;

const POLISH_CITIES = [
	"Warszawa",
	"Kraków",
	"Wrocław",
	"Poznań",
	"Gdańsk",
	"Łódź",
	"Lublin",
	"Katowice",
] as const;

/** Pierwsze dwie cyfry kodów pocztowych miast, żeby adresy były wiarygodne. */
const POSTAL_PREFIXES: Record<(typeof POLISH_CITIES)[number], string[]> = {
	Warszawa: ["00", "01", "02", "03", "04"],
	Kraków: ["30", "31"],
	Wrocław: ["50", "51", "52", "53", "54"],
	Poznań: ["60", "61"],
	Gdańsk: ["80"],
	Łódź: ["90", "91", "92", "93", "94"],
	Lublin: ["20"],
	Katowice: ["40"],
};

const STREET_NAMES = [
	"ul. Długa",
	"ul. Krótka",
	"ul. Lipowa",
	"ul. Polna",
	"ul. Leśna",
	"ul. Słoneczna",
	"ul. Ogrodowa",
	"ul. Kościuszki",
	"ul. Mickiewicza",
	"ul. Sienkiewicza",
	"ul. Słowackiego",
	"ul. Kwiatowa",
	"ul. Szkolna",
	"ul. Parkowa",
	"al. Niepodległości",
	"al. Wojska Polskiego",
	"pl. Wolności",
] as const;

/** Wydawnictwa zagraniczne (kraj, miasto) — uzupełniają polskie z PUBLISHER_NAMES. */
const FOREIGN_PUBLISHERS = [
	{ name: "Penguin Books", countryCode: "GB", city: "Londyn" },
	{ name: "Gallimard", countryCode: "FR", city: "Paryż" },
	{ name: "Suhrkamp", countryCode: "DE", city: "Berlin" },
	{ name: "Anagrama", countryCode: "ES", city: "Barcelona" },
	{ name: "Einaudi", countryCode: "IT", city: "Turyn" },
	{ name: "Bonnier", countryCode: "SE", city: "Sztokholm" },
] as const;

const TITLE_ADJECTIVES = [
	"Cichy",
	"Zaginiony",
	"Ostatni",
	"Pierwszy",
	"Czerwony",
	"Biały",
	"Czarny",
	"Złoty",
	"Srebrny",
	"Ukryty",
	"Daleki",
	"Bliski",
	"Stary",
	"Nowy",
	"Wielki",
	"Mały",
	"Dziki",
	"Spokojny",
	"Burzliwy",
	"Wieczny",
];

const TITLE_NOUNS = [
	"ogród",
	"las",
	"most",
	"dom",
	"klucz",
	"list",
	"sekret",
	"cień",
	"światło",
	"morze",
	"góry",
	"miasto",
	"droga",
	"czas",
	"sen",
	"głos",
	"zwierciadło",
	"księżyc",
	"słońce",
	"wiatr",
];

const TITLE_SUFFIXES = [
	"nad Wisłą",
	"w nocy",
	"bez końca",
	"po burzy",
	"na krańcu świata",
	"w deszczu",
	"pod śniegiem",
	"wśród gwiazd",
	"dla nieobecnych",
	"i inne historie",
];

/** Mulberry32 — deterministyczny PRNG. */
function createRng(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function pick<T>(rng: () => number, items: readonly T[]): T {
	const item = items[Math.floor(rng() * items.length)];
	if (item === undefined) {
		throw new Error("Cannot pick from empty list");
	}
	return item;
}

function pickN<T>(rng: () => number, items: readonly T[], n: number): T[] {
	const copy = [...items];
	const result: T[] = [];
	const count = Math.min(n, copy.length);
	for (let i = 0; i < count; i++) {
		const idx = Math.floor(rng() * copy.length);
		const [chosen] = copy.splice(idx, 1);
		if (chosen !== undefined) result.push(chosen);
	}
	return result;
}

/** Polski adres: ulica z numerem (czasem z lokalem), kod zgodny z miastem. */
function randomPolishAddress(
	rng: () => number,
	city: (typeof POLISH_CITIES)[number] = pick(rng, POLISH_CITIES),
) {
	const building = 1 + Math.floor(rng() * 120);
	const flat = rng() < 0.6 ? `/${1 + Math.floor(rng() * 60)}` : "";
	const prefix = pick(rng, POSTAL_PREFIXES[city]);
	const suffix = String(Math.floor(rng() * 1000)).padStart(3, "0");
	return {
		street: `${pick(rng, STREET_NAMES)} ${building}${flat}`,
		postalCode: `${prefix}-${suffix}`,
		city: city as string,
	};
}

function daysAgo(rng: () => number, minDays: number, maxDays: number): Date {
	const days = minDays + Math.floor(rng() * (maxDays - minDays + 1));
	const d = new Date();
	d.setHours(12, 0, 0, 0);
	d.setDate(d.getDate() - days);
	return d;
}

function addDays(date: Date, days: number): Date {
	const d = new Date(date);
	d.setDate(d.getDate() + days);
	return d;
}

/** "Prószyński i S-ka" -> "proszynskiiska" — do generowania adresów www/e-mail. */
function slugify(text: string): string {
	return text
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/ł/g, "l")
		.replace(/Ł/g, "L")
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");
}

function padEan(n: number): string {
	return `978${String(n).padStart(10, "0")}`;
}

function peselForIndex(i: number): string {
	return String(90000000000 + i).slice(0, 11);
}

async function createManyBatched<T>(
	label: string,
	rows: T[],
	insert: (batch: T[]) => Promise<unknown>,
) {
	for (let i = 0; i < rows.length; i += BATCH) {
		const batch = rows.slice(i, i + BATCH);
		await insert(batch);
		console.log(
			`  ${label}: ${Math.min(i + BATCH, rows.length)}/${rows.length}`,
		);
	}
}

async function wipe() {
	console.log("Clearing existing data…");
	await prisma.loan.deleteMany();
	await prisma.reservation.deleteMany();
	await prisma.copy.deleteMany();
	await prisma.edition.deleteMany();
	await prisma.workGenre.deleteMany();
	await prisma.authorGenre.deleteMany();
	await prisma.workAuthor.deleteMany();
	await prisma.work.deleteMany();
	await prisma.author.deleteMany();
	await prisma.publisher.deleteMany();
	await prisma.genre.deleteMany();
	await prisma.country.deleteMany();
	await prisma.language.deleteMany();
	await prisma.session.deleteMany();
	await prisma.account.deleteMany();
	await prisma.verification.deleteMany();
	await prisma.user.deleteMany();
}

async function seedUsers(passwordHash: string) {
	const rng = createRng(1);
	const users: {
		id: string;
		name: string;
		email: string;
		emailVerified: boolean;
		firstName: string;
		lastName: string;
		phone: string;
		pesel: string;
		street: string;
		postalCode: string;
		city: string;
		role: "LIBRARIAN" | "MEMBER";
		isActive: boolean;
	}[] = [];
	const accounts: {
		id: string;
		accountId: string;
		providerId: string;
		userId: string;
		password: string;
	}[] = [];

	for (let i = 1; i <= COUNTS.librarians; i++) {
		const id = randomUUID();
		const firstName = pick(rng, FIRST_NAMES);
		const lastName = pick(rng, LAST_NAMES);
		users.push({
			id,
			name: `${firstName} ${lastName}`,
			email: `bibliotekarz${i}@example.com`,
			emailVerified: true,
			firstName,
			lastName,
			phone: `+48500${String(100000 + i).slice(0, 6)}`,
			pesel: peselForIndex(i),
			...randomPolishAddress(rng),
			role: "LIBRARIAN",
			isActive: true,
		});
		accounts.push({
			id: randomUUID(),
			accountId: id,
			providerId: "credential",
			userId: id,
			password: passwordHash,
		});
	}

	for (let i = 1; i <= COUNTS.members; i++) {
		const id = randomUUID();
		const firstName = pick(rng, FIRST_NAMES);
		const lastName = pick(rng, LAST_NAMES);
		users.push({
			id,
			name: `${firstName} ${lastName}`,
			email: `czytelnik${i}@example.com`,
			emailVerified: true,
			firstName,
			lastName,
			phone: `+48501${String(100000 + i).slice(0, 6)}`,
			pesel: peselForIndex(COUNTS.librarians + i),
			...randomPolishAddress(rng),
			role: "MEMBER",
			isActive: true,
		});
		accounts.push({
			id: randomUUID(),
			accountId: id,
			providerId: "credential",
			userId: id,
			password: passwordHash,
		});
	}

	await createManyBatched("users", users, (batch) =>
		prisma.user.createMany({ data: batch }),
	);
	await createManyBatched("accounts", accounts, (batch) =>
		prisma.account.createMany({ data: batch }),
	);

	return users.filter((u) => u.role === "MEMBER").map((u) => u.id);
}

async function seedDictionaries() {
	await prisma.country.createMany({
		data: [...COUNTRIES],
		skipDuplicates: true,
	});
	await prisma.language.createMany({
		data: [...LANGUAGES],
		skipDuplicates: true,
	});
}

async function seedCatalog() {
	const rng = createRng(42);

	// Większość autorów pisze po polsku; pozostali po angielsku lub w innym języku.
	const authors = Array.from({ length: COUNTS.authors }, () => {
		const roll = rng();
		const writingLanguage: LanguageCode =
			roll < 0.65
				? "pl"
				: roll < 0.8
					? "en"
					: pick(rng, LANGUAGES.slice(2)).code;
		return {
			id: randomUUID(),
			firstName: pick(rng, FIRST_NAMES),
			lastName: pick(rng, LAST_NAMES),
			countryCode:
				rng() < 0.9 ? pick(rng, COUNTRIES_BY_LANGUAGE[writingLanguage]) : null,
			birthYear: rng() < 0.85 ? 1780 + Math.floor(rng() * 221) : null,
			writingLanguage,
		};
	});
	await createManyBatched("authors", authors, (batch) =>
		prisma.author.createMany({
			data: batch.map(({ writingLanguage: _, ...author }) => author),
		}),
	);

	const publishers = [
		...PUBLISHER_NAMES.slice(
			0,
			COUNTS.publishers - FOREIGN_PUBLISHERS.length,
		).map((name) => ({
			name,
			countryCode: "PL" as CountryCode,
			...randomPolishAddress(rng),
		})),
		...FOREIGN_PUBLISHERS,
	].map((publisher) => {
		const slug = slugify(publisher.name);
		return {
			id: randomUUID(),
			...publisher,
			// Domena .example (RFC 2606) — nie wskazuje prawdziwych serwisów.
			email: rng() < 0.8 ? `kontakt@${slug}.example` : null,
			website: rng() < 0.9 ? `https://www.${slug}.example` : null,
		};
	});
	await createManyBatched("publishers", publishers, (batch) =>
		prisma.publisher.createMany({ data: batch }),
	);

	const genres = GENRE_NAMES.slice(0, COUNTS.genres).map((name) => ({
		id: randomUUID(),
		name,
	}));
	await createManyBatched("genres", genres, (batch) =>
		prisma.genre.createMany({ data: batch }),
	);

	const works: {
		id: string;
		title: string;
		originalTitle: string | null;
		description: string | null;
		originalYear: number | null;
		originalLanguageCode: LanguageCode;
	}[] = [];
	const workAuthors: {
		id: string;
		workId: string;
		authorId: string;
		authorOrder: number;
	}[] = [];
	const workGenres: { workId: string; genreId: string }[] = [];
	const authorGenreKeys = new Set<string>();
	const editions: {
		id: string;
		workId: string;
		ean: string;
		pageCount: number;
		publicationYear: number;
		languageCode: LanguageCode;
		format: "HARDCOVER" | "PAPERBACK";
		publisherId: string;
	}[] = [];
	const copies: {
		id: string;
		editionId: string;
		inventoryNo: string;
		status: "AVAILABLE" | "LOST" | "MAINTENANCE";
	}[] = [];

	let eanSeq = 1;
	let inventorySeq = 1;

	for (let i = 1; i <= COUNTS.works; i++) {
		const workId = randomUUID();
		const adj = pick(rng, TITLE_ADJECTIVES);
		const noun = pick(rng, TITLE_NOUNS);
		const suffix = rng() < 0.4 ? ` ${pick(rng, TITLE_SUFFIXES)}` : "";
		const originalYear = rng() < 0.9 ? 1800 + Math.floor(rng() * 220) : null;

		// Język oryginału wynika z języka pierwszego autora.
		const authorCount = 1 + Math.floor(rng() * 3);
		const chosenAuthors = pickN(rng, authors, authorCount);
		const originalLanguageCode = chosenAuthors[0]?.writingLanguage ?? "pl";

		let originalTitle: string | null = null;
		if (originalLanguageCode !== "pl") {
			const [first, second] = ORIGINAL_TITLE_WORDS[originalLanguageCode];
			originalTitle = `${pick(rng, first)} ${pick(rng, second)}`;
		}

		works.push({
			id: workId,
			title: `${adj} ${noun}${suffix}`,
			originalTitle,
			description: rng() < 0.75 ? pick(rng, DESCRIPTION_TEMPLATES)(noun) : null,
			originalYear,
			originalLanguageCode,
		});

		chosenAuthors.forEach((author, order) => {
			workAuthors.push({
				id: randomUUID(),
				workId,
				authorId: author.id,
				authorOrder: order + 1,
			});
		});

		const genreCount = 1 + Math.floor(rng() * 2);
		for (const genre of pickN(rng, genres, genreCount)) {
			workGenres.push({ workId, genreId: genre.id });
			// Gatunki autora to gatunki jego utworów.
			for (const author of chosenAuthors) {
				authorGenreKeys.add(`${author.id}|${genre.id}`);
			}
		}

		const minYear = Math.max(originalYear ?? 1950, 1950);
		const editionCount = 1 + Math.floor(rng() * COUNTS.maxEditionsPerWork);
		for (let e = 0; e < editionCount; e++) {
			const editionId = randomUUID();
			editions.push({
				id: editionId,
				workId,
				ean: padEan(eanSeq),
				pageCount: 120 + Math.floor(rng() * 680),
				publicationYear: minYear + Math.floor(rng() * (2026 - minYear + 1)),
				languageCode: rng() < 0.8 ? "pl" : originalLanguageCode,
				format: rng() < 0.6 ? "PAPERBACK" : "HARDCOVER",
				publisherId: pick(rng, publishers).id,
			});
			eanSeq += 1;

			const copyCount = 1 + Math.floor(rng() * 4);
			for (let c = 0; c < copyCount; c++) {
				const roll = rng();
				let status: "AVAILABLE" | "LOST" | "MAINTENANCE" = "AVAILABLE";
				if (roll < 0.02) status = "LOST";
				else if (roll < 0.04) status = "MAINTENANCE";

				copies.push({
					id: randomUUID(),
					editionId,
					inventoryNo: `INV-${String(inventorySeq).padStart(6, "0")}`,
					status,
				});
				inventorySeq += 1;
			}
		}
	}

	await createManyBatched("works", works, (batch) =>
		prisma.work.createMany({ data: batch }),
	);
	await createManyBatched("workAuthors", workAuthors, (batch) =>
		prisma.workAuthor.createMany({ data: batch }),
	);
	await createManyBatched("workGenres", workGenres, (batch) =>
		prisma.workGenre.createMany({ data: batch }),
	);
	const authorGenres = [...authorGenreKeys].map((key) => {
		const [authorId = "", genreId = ""] = key.split("|");
		return { authorId, genreId };
	});
	await createManyBatched("authorGenres", authorGenres, (batch) =>
		prisma.authorGenre.createMany({ data: batch }),
	);
	await createManyBatched("editions", editions, (batch) =>
		prisma.edition.createMany({ data: batch }),
	);
	await createManyBatched("copies", copies, (batch) =>
		prisma.copy.createMany({ data: batch }),
	);

	return { works, editions, copies };
}

async function seedLoans(
	memberIds: string[],
	copies: { id: string; status: string }[],
) {
	const rng = createRng(99);
	const pool = copies.filter((c) => c.status === "AVAILABLE").map((c) => c.id);
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		const a = pool[i];
		const b = pool[j];
		if (a === undefined || b === undefined) continue;
		pool[i] = b;
		pool[j] = a;
	}

	let cursor = 0;
	/** Returned loans may reuse copies; active loans remove them from the pool. */
	const pickReturnedCopy = () => {
		if (pool.length === 0) return undefined;
		const id = pool[cursor % pool.length];
		cursor += 1;
		return id;
	};
	const takeActiveCopy = () => {
		const id = pool.pop();
		return id;
	};

	const loans: {
		id: string;
		copyId: string;
		userId: string;
		loanedAt: Date;
		dueAt: Date;
		returnedAt: Date | null;
	}[] = [];
	const loanedCopyIds = new Set<string>();

	for (const userId of memberIds) {
		const historyCount = 3 + Math.floor(rng() * 8);
		for (let h = 0; h < historyCount; h++) {
			const copyId = pickReturnedCopy();
			if (!copyId) break;

			const loanedAt = daysAgo(rng, 30, 700);
			const dueAt = addDays(loanedAt, LOAN_DAYS);
			const late = rng() < 0.35;
			const returnedAt = late
				? addDays(dueAt, 1 + Math.floor(rng() * 21))
				: addDays(loanedAt, 1 + Math.floor(rng() * LOAN_DAYS));

			loans.push({
				id: randomUUID(),
				copyId,
				userId,
				loanedAt,
				dueAt,
				returnedAt,
			});
		}

		const hasOverdue = rng() < 0.2;
		const activeCount = hasOverdue
			? 1 + Math.floor(rng() * 2)
			: Math.floor(rng() * 4);

		for (let a = 0; a < activeCount; a++) {
			const copyId = takeActiveCopy();
			if (!copyId) break;

			let loanedAt: Date;
			let dueAt: Date;
			if (hasOverdue && a === 0) {
				loanedAt = daysAgo(rng, LOAN_DAYS + 1, LOAN_DAYS + 40);
				dueAt = addDays(loanedAt, LOAN_DAYS);
			} else {
				loanedAt = daysAgo(rng, 0, LOAN_DAYS - 1);
				dueAt = addDays(loanedAt, LOAN_DAYS);
			}

			loans.push({
				id: randomUUID(),
				copyId,
				userId,
				loanedAt,
				dueAt,
				returnedAt: null,
			});
			loanedCopyIds.add(copyId);
		}
	}

	await createManyBatched("loans", loans, (batch) =>
		prisma.loan.createMany({ data: batch }),
	);

	return { loanCount: loans.length, activeCount: loanedCopyIds.size };
}

async function seedReservations(
	memberIds: string[],
	works: { id: string }[],
	copies: { id: string; status: string; edition: { workId: string } }[],
) {
	const rng = createRng(7);
	const availableByWork = new Map<string, number>();
	for (const copy of copies) {
		if (copy.status !== "AVAILABLE") continue;
		const { workId } = copy.edition;
		availableByWork.set(workId, (availableByWork.get(workId) ?? 0) + 1);
	}

	// Works with no AVAILABLE copies after loans are ideal for PENDING reservations.
	const fullyLoanedWorkIds = works
		.map((w) => w.id)
		.filter((id) => (availableByWork.get(id) ?? 0) === 0);

	const pool =
		fullyLoanedWorkIds.length >= 10
			? fullyLoanedWorkIds
			: works.map((w) => w.id);

	const reservations: {
		id: string;
		workId: string;
		userId: string;
		status: "PENDING" | "FULFILLED" | "CANCELLED";
		createdAt: Date;
		closedAt: Date | null;
	}[] = [];
	const pendingPairs = new Set<string>();

	for (let i = 0; i < COUNTS.reservations; i++) {
		const userId = pick(rng, memberIds);
		const workId = pick(rng, pool);
		const roll = rng();
		let status: "PENDING" | "FULFILLED" | "CANCELLED";
		if (roll < 0.45) status = "PENDING";
		else if (roll < 0.75) status = "FULFILLED";
		else status = "CANCELLED";

		if (status === "PENDING") {
			const key = `${userId}:${workId}`;
			if (pendingPairs.has(key)) {
				status = "CANCELLED";
			} else {
				pendingPairs.add(key);
			}
		}

		const createdAt = daysAgo(rng, 1, 120);
		// Zamknięta rezerwacja: do 14 dni po złożeniu, nie później niż dziś.
		let closedAt: Date | null = null;
		if (status !== "PENDING") {
			const closed = new Date(createdAt);
			closed.setDate(closed.getDate() + Math.floor(rng() * 15));
			closedAt = closed > new Date() ? new Date() : closed;
		}

		reservations.push({
			id: randomUUID(),
			workId,
			userId,
			status,
			createdAt,
			closedAt,
		});
	}

	await createManyBatched("reservations", reservations, (batch) =>
		prisma.reservation.createMany({ data: batch }),
	);

	return reservations.length;
}

async function main() {
	console.log("Seeding library database…");
	await wipe();

	// Dane ładowane są już pod ograniczeniami (indeks, CHECK, trigger).
	await applyConstraints(DATABASE_URL);

	console.log("Hashing password…");
	const passwordHash = await hashPassword(PASSWORD);

	console.log("Seeding dictionaries…");
	await seedDictionaries();

	console.log("Seeding users…");
	const memberIds = await seedUsers(passwordHash);

	console.log("Seeding catalog…");
	const { works, editions, copies } = await seedCatalog();

	console.log("Seeding loans…");
	const { loanCount, activeCount } = await seedLoans(memberIds, copies);

	// Copies on loan keep status AVAILABLE, so drop them for reservation eligibility.
	const copiesAfterLoans = await prisma.copy.findMany({
		where: { loans: { none: { returnedAt: null } } },
		select: { id: true, status: true, edition: { select: { workId: true } } },
	});

	console.log("Seeding reservations…");
	const reservationCount = await seedReservations(
		memberIds,
		works,
		copiesAfterLoans,
	);

	console.log("\nSeed complete:");
	console.log(
		`  Librarians:  ${COUNTS.librarians}  (bibliotekarz1@example.com …)`,
	);
	console.log(`  Members:     ${COUNTS.members}  (czytelnik1@example.com …)`);
	console.log(`  Password:    ${PASSWORD}`);
	console.log(`  Authors:     ${COUNTS.authors}`);
	console.log(`  Publishers:  ${COUNTS.publishers}`);
	console.log(`  Genres:      ${COUNTS.genres}`);
	console.log(
		`  Countries:   ${COUNTRIES.length}, languages: ${LANGUAGES.length}`,
	);
	console.log(`  Works:       ${works.length}`);
	console.log(`  Editions:    ${editions.length}`);
	console.log(`  Copies:      ${copies.length}`);
	console.log(`  Loans:       ${loanCount} (${activeCount} active)`);
	console.log(`  Reservations: ${reservationCount}`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
