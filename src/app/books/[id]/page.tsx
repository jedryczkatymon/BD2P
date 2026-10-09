import { TRPCError } from "@trpc/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReserveButton } from "~/components/reserve-button";
import { getSession } from "~/server/better-auth/server";
import { api, HydrateClient } from "~/trpc/server";

type BookPageProps = {
	params: Promise<{ id: string }>;
};

function formatAuthors(authors: { firstName: string; lastName: string }[]) {
	if (authors.length === 0) return "Autor nieznany";
	return authors.map((a) => `${a.firstName} ${a.lastName}`).join(", ");
}

export default async function BookPage({ params }: BookPageProps) {
	const { id } = await params;
	const session = await getSession();

	let book: Awaited<ReturnType<typeof api.book.byId>>;
	try {
		book = await api.book.byId({ id });
	} catch (error) {
		if (error instanceof TRPCError && error.code === "NOT_FOUND") {
			notFound();
		}
		throw error;
	}

	const reservation = session?.user
		? await api.book.myReservation({ bookId: id })
		: null;

	const { copiesSummary } = book;

	return (
		<HydrateClient>
			<main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
				<p className="mb-6">
					<Link
						className="text-sm text-stone-600 transition hover:text-teal-800"
						href="/"
					>
						← Wróć do katalogu
					</Link>
				</p>

				<article>
					<h1 className="font-semibold text-2xl text-stone-900 tracking-tight sm:text-3xl">
						{book.title}
					</h1>
					<p className="mt-2 text-lg text-stone-600">
						{formatAuthors(book.authors)}
					</p>

					<dl className="mt-8 grid gap-4 sm:grid-cols-2">
						<div>
							<dt className="font-medium text-stone-500 text-xs uppercase tracking-wide">
								Wydawca
							</dt>
							<dd className="mt-1 text-stone-900">{book.publisher.name}</dd>
						</div>
						<div>
							<dt className="font-medium text-stone-500 text-xs uppercase tracking-wide">
								Rok wydania
							</dt>
							<dd className="mt-1 text-stone-900">{book.publicationYear}</dd>
						</div>
						<div>
							<dt className="font-medium text-stone-500 text-xs uppercase tracking-wide">
								Liczba stron
							</dt>
							<dd className="mt-1 text-stone-900">{book.pageCount}</dd>
						</div>
						<div>
							<dt className="font-medium text-stone-500 text-xs uppercase tracking-wide">
								EAN
							</dt>
							<dd className="mt-1 font-mono text-sm text-stone-900">
								{book.ean}
							</dd>
						</div>
						{book.categories.length > 0 && (
							<div className="sm:col-span-2">
								<dt className="font-medium text-stone-500 text-xs uppercase tracking-wide">
									Kategorie
								</dt>
								<dd className="mt-1 text-stone-900">
									{book.categories.map((c) => c.name).join(", ")}
								</dd>
							</div>
						)}
					</dl>

					<section className="mt-10 border-stone-200 border-t pt-6">
						<h2 className="font-medium text-stone-900">Egzemplarze</h2>
						<ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
							<li className="rounded-md border border-stone-200 bg-white px-3 py-2">
								<span className="text-stone-500">Dostępne</span>
								<p className="font-medium text-teal-800">
									{copiesSummary.available}
								</p>
							</li>
							<li className="rounded-md border border-stone-200 bg-white px-3 py-2">
								<span className="text-stone-500">Wypożyczone</span>
								<p className="font-medium text-amber-800">
									{copiesSummary.loaned}
								</p>
							</li>
							<li className="rounded-md border border-stone-200 bg-white px-3 py-2">
								<span className="text-stone-500">Łącznie</span>
								<p className="font-medium text-stone-900">
									{copiesSummary.total}
								</p>
							</li>
						</ul>

						<ReserveButton
							availableCount={copiesSummary.available}
							bookId={book.id}
							isLoggedIn={Boolean(session?.user)}
							reservationId={reservation?.id ?? null}
						/>
					</section>
				</article>
			</main>
		</HydrateClient>
	);
}
