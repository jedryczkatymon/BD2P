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
	categories: 20,
	books: 2000,
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

const CATEGORY_NAMES = [
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
	await prisma.bookCategory.deleteMany();
	await prisma.bookAuthor.deleteMany();
	await prisma.book.deleteMany();
	await prisma.author.deleteMany();
	await prisma.publisher.deleteMany();
	await prisma.category.deleteMany();
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

async function seedCatalog() {
	const rng = createRng(42);

	const authors = Array.from({ length: COUNTS.authors }, () => ({
		id: randomUUID(),
		firstName: pick(rng, FIRST_NAMES),
		lastName: pick(rng, LAST_NAMES),
	}));
	await createManyBatched("authors", authors, (batch) =>
		prisma.author.createMany({ data: batch }),
	);

	const publishers = PUBLISHER_NAMES.slice(0, COUNTS.publishers).map(
		(name) => ({
			id: randomUUID(),
			name,
		}),
	);
	await createManyBatched("publishers", publishers, (batch) =>
		prisma.publisher.createMany({ data: batch }),
	);

	const categories = CATEGORY_NAMES.slice(0, COUNTS.categories).map((name) => ({
		id: randomUUID(),
		name,
	}));
	await createManyBatched("categories", categories, (batch) =>
		prisma.category.createMany({ data: batch }),
	);

	const books: {
		id: string;
		title: string;
		ean: string;
		pageCount: number;
		publicationYear: number;
		publisherId: string;
	}[] = [];
	const bookAuthors: {
		id: string;
		bookId: string;
		authorId: string;
		authorOrder: number;
	}[] = [];
	const bookCategories: { bookId: string; categoryId: string }[] = [];
	const copies: {
		id: string;
		bookId: string;
		inventoryNo: string;
		status: "AVAILABLE" | "LOST" | "MAINTENANCE";
	}[] = [];

	let inventorySeq = 1;

	for (let i = 1; i <= COUNTS.books; i++) {
		const bookId = randomUUID();
		const adj = pick(rng, TITLE_ADJECTIVES);
		const noun = pick(rng, TITLE_NOUNS);
		const suffix = rng() < 0.4 ? ` ${pick(rng, TITLE_SUFFIXES)}` : "";
		const publisher = pick(rng, publishers);

		books.push({
			id: bookId,
			title: `${adj} ${noun}${suffix}`,
			ean: padEan(i),
			pageCount: 120 + Math.floor(rng() * 680),
			publicationYear: 1980 + Math.floor(rng() * 46),
			publisherId: publisher.id,
		});

		const authorCount = 1 + Math.floor(rng() * 3);
		const chosenAuthors = pickN(rng, authors, authorCount);
		chosenAuthors.forEach((author, order) => {
			bookAuthors.push({
				id: randomUUID(),
				bookId,
				authorId: author.id,
				authorOrder: order + 1,
			});
		});

		const categoryCount = 1 + Math.floor(rng() * 2);
		for (const category of pickN(rng, categories, categoryCount)) {
			bookCategories.push({ bookId, categoryId: category.id });
		}

		const copyCount = 1 + Math.floor(rng() * 4);
		for (let c = 0; c < copyCount; c++) {
			const roll = rng();
			let status: "AVAILABLE" | "LOST" | "MAINTENANCE" = "AVAILABLE";
			if (roll < 0.02) status = "LOST";
			else if (roll < 0.04) status = "MAINTENANCE";

			copies.push({
				id: randomUUID(),
				bookId,
				inventoryNo: `INV-${String(inventorySeq).padStart(6, "0")}`,
				status,
			});
			inventorySeq += 1;
		}
	}

	await createManyBatched("books", books, (batch) =>
		prisma.book.createMany({ data: batch }),
	);
	await createManyBatched("bookAuthors", bookAuthors, (batch) =>
		prisma.bookAuthor.createMany({ data: batch }),
	);
	await createManyBatched("bookCategories", bookCategories, (batch) =>
		prisma.bookCategory.createMany({ data: batch }),
	);
	await createManyBatched("copies", copies, (batch) =>
		prisma.copy.createMany({ data: batch }),
	);

	return { books, copies };
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

	const loanedIds = [...loanedCopyIds];
	for (let i = 0; i < loanedIds.length; i += BATCH) {
		const batch = loanedIds.slice(i, i + BATCH);
		await prisma.copy.updateMany({
			where: { id: { in: batch } },
			data: { status: "LOANED" },
		});
	}

	return { loanCount: loans.length, activeCount: loanedCopyIds.size };
}

async function seedReservations(
	memberIds: string[],
	books: { id: string }[],
	copies: { id: string; bookId: string; status: string }[],
) {
	const rng = createRng(7);
	const availableByBook = new Map<string, number>();
	for (const copy of copies) {
		if (copy.status !== "AVAILABLE") continue;
		availableByBook.set(
			copy.bookId,
			(availableByBook.get(copy.bookId) ?? 0) + 1,
		);
	}

	// Books with no AVAILABLE copies after loans are ideal for PENDING reservations.
	const fullyLoanedBookIds = books
		.map((b) => b.id)
		.filter((id) => (availableByBook.get(id) ?? 0) === 0);

	const pool =
		fullyLoanedBookIds.length >= 10
			? fullyLoanedBookIds
			: books.map((b) => b.id);

	const reservations: {
		id: string;
		bookId: string;
		userId: string;
		status: "PENDING" | "FULFILLED" | "CANCELLED";
		createdAt: Date;
	}[] = [];
	const pendingPairs = new Set<string>();

	for (let i = 0; i < COUNTS.reservations; i++) {
		const userId = pick(rng, memberIds);
		const bookId = pick(rng, pool);
		const roll = rng();
		let status: "PENDING" | "FULFILLED" | "CANCELLED";
		if (roll < 0.45) status = "PENDING";
		else if (roll < 0.75) status = "FULFILLED";
		else status = "CANCELLED";

		if (status === "PENDING") {
			const key = `${userId}:${bookId}`;
			if (pendingPairs.has(key)) {
				status = "CANCELLED";
			} else {
				pendingPairs.add(key);
			}
		}

		reservations.push({
			id: randomUUID(),
			bookId,
			userId,
			status,
			createdAt: daysAgo(rng, 1, 120),
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

	console.log("Seeding users…");
	const memberIds = await seedUsers(passwordHash);

	console.log("Seeding catalog…");
	const { books, copies } = await seedCatalog();

	console.log("Seeding loans…");
	const { loanCount, activeCount } = await seedLoans(memberIds, copies);

	// Refresh copy statuses from DB for reservation eligibility.
	const copiesAfterLoans = await prisma.copy.findMany({
		select: { id: true, bookId: true, status: true },
	});

	console.log("Seeding reservations…");
	const reservationCount = await seedReservations(
		memberIds,
		books,
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
	console.log(`  Categories:  ${COUNTS.categories}`);
	console.log(`  Books:       ${books.length}`);
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
