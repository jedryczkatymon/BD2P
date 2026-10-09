import Link from "next/link";
import { redirect } from "next/navigation";

import { ActiveLoansTable } from "~/components/active-loans-table";
import { ActiveReservationsTable } from "~/components/active-reservations-table";
import { CatalogAdmin } from "~/components/catalog-admin";
import { CategoryAdmin } from "~/components/category-admin";
import { CreateLoanForm } from "~/components/create-loan-form";
import { LibrarianPagination } from "~/components/librarian-pagination";
import { LibrarianSearchForm } from "~/components/librarian-search-form";
import { LibrarianTabs } from "~/components/librarian-tabs";
import { LoanHistoryTable } from "~/components/loan-history-table";
import { ReservationHistoryTable } from "~/components/reservation-history-table";
import { UsersTable } from "~/components/users-table";
import { parseLibrarianTab, parsePageSize } from "~/lib/librarian-query";
import { getSession } from "~/server/better-auth/server";
import { api, HydrateClient } from "~/trpc/server";

type LibrarianPageProps = {
	searchParams: Promise<{
		tab?: string;
		page?: string;
		loanPage?: string;
		pageSize?: string;
		q?: string;
		status?: string;
		bookId?: string;
		section?: string;
		overdue?: string;
	}>;
};

function optionalParam(value: string | undefined) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function isLibrarianRole(role: unknown): role is "LIBRARIAN" {
	return role === "LIBRARIAN";
}

export default async function LibrarianPage({
	searchParams,
}: LibrarianPageProps) {
	const session = await getSession();
	if (!session?.user) {
		redirect("/login");
	}

	const role = (session.user as { role?: string }).role;
	if (!isLibrarianRole(role)) {
		redirect("/");
	}

	const params = await searchParams;
	const tab = parseLibrarianTab(params.tab);
	const pageSize = parsePageSize(params.pageSize);
	const page = Math.max(1, Number(params.page) || 1);
	const loanPage = Math.max(1, Number(params.loanPage) || 1);
	const q = optionalParam(params.q);
	const bookId = optionalParam(params.bookId);
	const overdueOnly = params.overdue === "1";
	const statusParam = optionalParam(params.status);
	const status =
		statusParam === "FULFILLED" || statusParam === "CANCELLED"
			? statusParam
			: undefined;

	return (
		<HydrateClient>
			<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
				<div className="mb-6">
					<h1 className="font-semibold text-2xl text-stone-900 tracking-tight">
						Panel bibliotekarza
					</h1>
					<p className="mt-1 text-stone-600">
						Aktywne wypożyczenia i rezerwacje, archiwum, księgozbiór oraz
						użytkownicy.
					</p>
				</div>

				<LibrarianTabs active={tab} />

				{tab === "active" ? (
					<ActiveTab
						overdueOnly={overdueOnly}
						page={page}
						pageSize={pageSize}
						q={q}
					/>
				) : null}

				{tab === "users" ? (
					<UsersTab page={page} pageSize={pageSize} q={q} />
				) : null}

				{tab === "archive" ? (
					<ArchiveTab
						loanPage={loanPage}
						page={page}
						pageSize={pageSize}
						q={q}
						status={status}
					/>
				) : null}

				{tab === "catalog" ? (
					<CatalogTab bookId={bookId} page={page} pageSize={pageSize} q={q} />
				) : null}
			</main>
		</HydrateClient>
	);
}

async function UsersTab({
	page,
	pageSize,
	q,
}: {
	page: number;
	pageSize: 50 | 100 | 200;
	q?: string;
}) {
	const data = await api.librarian.listUsers({ page, pageSize, q });

	return (
		<div className="mt-6">
			<h2 className="font-medium text-stone-900">Użytkownicy ({data.total})</h2>
			<div className="mt-3">
				<LibrarianSearchForm
					actionTab="users"
					pageSize={pageSize}
					placeholder="Imię, nazwisko, e-mail, telefon, PESEL…"
					q={q}
				/>
			</div>
			<UsersTable currentUserId={data.currentUserId} items={data.items} />
			<div className="mt-4">
				<LibrarianPagination
					emptyLabel="Brak użytkowników"
					filters={{ q, pageSize }}
					page={data.page}
					pageSize={pageSize}
					tab="users"
					total={data.total}
				/>
			</div>
		</div>
	);
}

async function ActiveTab({
	page,
	pageSize,
	q,
	overdueOnly,
}: {
	page: number;
	pageSize: 50 | 100 | 200;
	q?: string;
	overdueOnly: boolean;
}) {
	const [loans, reservations] = await Promise.all([
		api.librarian.listActiveLoans({ page, pageSize, q, overdueOnly }),
		api.librarian.listActiveReservations({ page, pageSize, q }),
	]);

	const filters = { q, pageSize, overdue: overdueOnly };

	return (
		<div className="mt-6 space-y-10">
			<section>
				<h2 className="font-medium text-stone-900">Nowe wypożyczenie (lada)</h2>
				<p className="mt-1 text-sm text-stone-600">
					Podaj numer inwentarzowy egzemplarza oraz e-mail czytelnika.
				</p>
				<CreateLoanForm />
			</section>

			<section>
				<div className="flex flex-wrap items-end justify-between gap-3">
					<h2 className="font-medium text-stone-900">
						{overdueOnly
							? "Przeterminowane wypożyczenia"
							: "Aktywne wypożyczenia"}{" "}
						({loans.total})
					</h2>
					<p
						className={
							loans.overdueTotal > 0
								? "font-medium text-red-800 text-sm"
								: "text-sm text-stone-500"
						}
					>
						Po terminie: {loans.overdueTotal}
					</p>
				</div>
				<div className="mt-3">
					<LibrarianSearchForm
						actionTab="active"
						extraFields={
							<label className="flex h-10 items-center gap-2 text-sm text-stone-800">
								<input
									defaultChecked={overdueOnly}
									name="overdue"
									type="checkbox"
									value="1"
								/>
								Tylko po terminie
							</label>
						}
						pageSize={pageSize}
						placeholder="Tytuł, EAN, nr egzemplarza, czytelnik…"
						q={q}
					/>
				</div>
				<ActiveLoansTable items={loans.items} />
				<div className="mt-4">
					<LibrarianPagination
						emptyLabel="Brak aktywnych wypożyczeń"
						filters={filters}
						page={loans.page}
						pageSize={pageSize}
						tab="active"
						total={loans.total}
					/>
				</div>
			</section>

			<section>
				<h2 className="font-medium text-stone-900">
					Aktywne rezerwacje ({reservations.total})
				</h2>
				<ActiveReservationsTable items={reservations.items} />
				<div className="mt-4">
					<LibrarianPagination
						emptyLabel="Brak aktywnych rezerwacji"
						filters={filters}
						page={reservations.page}
						pageSize={pageSize}
						tab="active"
						total={reservations.total}
					/>
				</div>
			</section>
		</div>
	);
}

async function ArchiveTab({
	page,
	loanPage,
	pageSize,
	q,
	status,
}: {
	page: number;
	loanPage: number;
	pageSize: 50 | 100 | 200;
	q?: string;
	status?: "FULFILLED" | "CANCELLED";
}) {
	const [reservations, loans] = await Promise.all([
		api.librarian.listReservationHistory({
			page,
			pageSize,
			q,
			status,
		}),
		api.librarian.listLoanHistory({
			page: loanPage,
			pageSize,
			q,
		}),
	]);

	const sharedFilters = {
		q,
		pageSize,
		status,
		page,
		loanPage,
	};

	return (
		<div className="mt-6 space-y-10">
			<section>
				<h2 className="font-medium text-stone-900">
					Historia wypożyczeń ({loans.total})
				</h2>
				<div className="mt-3">
					<LibrarianSearchForm
						actionTab="archive"
						pageSize={pageSize}
						placeholder="Tytuł, EAN, nr egzemplarza, czytelnik…"
						q={q}
					/>
				</div>
				<LoanHistoryTable items={loans.items} />
				<div className="mt-4">
					<LibrarianPagination
						emptyLabel="Brak historii wypożyczeń"
						filters={sharedFilters}
						page={loans.page}
						pageParam="loanPage"
						pageSize={pageSize}
						tab="archive"
						total={loans.total}
					/>
				</div>
			</section>

			<section>
				<h2 className="font-medium text-stone-900">
					Historia rezerwacji ({reservations.total})
				</h2>
				<div className="mt-3">
					<LibrarianSearchForm
						actionTab="archive"
						extraFields={
							<label className="min-w-[10rem]">
								<span className="mb-1 block font-medium text-stone-500 text-xs uppercase tracking-wide">
									Status
								</span>
								<select
									className="h-10 w-full rounded-md border border-stone-300 bg-white px-2.5 text-sm text-stone-900 outline-none focus:border-teal-700"
									defaultValue={status ?? ""}
									name="status"
								>
									<option value="">Wszystkie zamknięte</option>
									<option value="FULFILLED">Zrealizowane</option>
									<option value="CANCELLED">Anulowane</option>
								</select>
							</label>
						}
						pageSize={pageSize}
						placeholder="Tytuł, EAN, czytelnik…"
						q={q}
					/>
				</div>
				<ReservationHistoryTable items={reservations.items} />
				<div className="mt-4">
					<LibrarianPagination
						emptyLabel="Brak historii rezerwacji"
						filters={sharedFilters}
						page={reservations.page}
						pageParam="page"
						pageSize={pageSize}
						tab="archive"
						total={reservations.total}
					/>
				</div>
			</section>
		</div>
	);
}

async function CatalogTab({
	page,
	pageSize,
	q,
	bookId,
}: {
	page: number;
	pageSize: 50 | 100 | 200;
	q?: string;
	bookId?: string;
}) {
	const [books, filterOptions, categoryRows] = await Promise.all([
		api.librarian.listBooks({ page, pageSize, q }),
		api.book.filterOptions(),
		api.librarian.listCategories(),
	]);

	return (
		<div className="mt-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<h2 className="font-medium text-stone-900">
					Księgozbiór ({books.total})
				</h2>
				<Link
					className="text-sm text-teal-800 hover:underline"
					href="/librarian?tab=catalog"
				>
					Odśwież listę
				</Link>
			</div>
			<div className="mt-3">
				<LibrarianSearchForm
					actionTab="catalog"
					pageSize={pageSize}
					placeholder="Tytuł, EAN, wydawnictwo…"
					q={q}
				/>
			</div>
			<CatalogAdmin
				books={books.items}
				categories={filterOptions.categories}
				selectedBookId={bookId}
				tableFooter={
					<LibrarianPagination
						emptyLabel="Brak książek"
						filters={{ q, pageSize }}
						page={books.page}
						pageSize={pageSize}
						tab="catalog"
						total={books.total}
					/>
				}
			/>
			<section className="mt-8 border-stone-200 border-t pt-6">
				<h2 className="font-medium text-stone-900">
					Kategorie ({categoryRows.length})
				</h2>
				<CategoryAdmin items={categoryRows} />
			</section>
		</div>
	);
}
