import { TRPCError } from "@trpc/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReserveButton } from "~/components/reserve-button";
import { BOOK_FORMAT_LABELS } from "~/lib/library-rules";
import { getSession } from "~/server/better-auth/server";
import { api, HydrateClient } from "~/trpc/server";

type WorkPageProps = {
	params: Promise<{ id: string }>;
};

function formatAuthors(authors: { firstName: string; lastName: string }[]) {
	if (authors.length === 0) return "Autor nieznany";
	return authors.map((a) => `${a.firstName} ${a.lastName}`).join(", ");
}

function formatAuthorDetails(author: {
	birthYear: number | null;
	country: { name: string } | null;
}) {
	const parts = [
		author.country?.name,
		author.birthYear !== null ? `ur. ${author.birthYear}` : undefined,
	].filter(Boolean);
	return parts.join(", ");
}

export default async function WorkPage({ params }: WorkPageProps) {
	const { id } = await params;
	const session = await getSession();

	let work: Awaited<ReturnType<typeof api.work.byId>>;
	try {
		work = await api.work.byId({ id });
	} catch (error) {
		if (error instanceof TRPCError && error.code === "NOT_FOUND") {
			notFound();
		}
		throw error;
	}

	const reservation = session?.user
		? await api.work.myReservation({ workId: id })
		: null;

	const { copiesSummary } = work;

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
						{work.title}
					</h1>
					{work.originalTitle ? (
						<p className="mt-1 text-stone-500 italic">{work.originalTitle}</p>
					) : null}
					<p className="mt-2 text-lg text-stone-600">
						{formatAuthors(work.authors)}
					</p>
					{work.description ? (
						<p className="mt-6 whitespace-pre-line text-stone-800 leading-relaxed">
							{work.description}
						</p>
					) : null}

					<dl className="mt-8 grid gap-4 sm:grid-cols-2">
						<div>
							<dt className="font-medium text-stone-500 text-xs uppercase tracking-wide">
								Rok powstania
							</dt>
							<dd className="mt-1 text-stone-900">
								{work.originalYear ?? "nieznany"}
							</dd>
						</div>
						<div>
							<dt className="font-medium text-stone-500 text-xs uppercase tracking-wide">
								Język oryginału
							</dt>
							<dd className="mt-1 text-stone-900">
								{work.originalLanguage.name}
							</dd>
						</div>
						{work.authors.some((a) => formatAuthorDetails(a)) && (
							<div className="sm:col-span-2">
								<dt className="font-medium text-stone-500 text-xs uppercase tracking-wide">
									Autorzy
								</dt>
								<dd className="mt-1 text-stone-900">
									<ul className="space-y-0.5">
										{work.authors.map((author) => {
											const details = formatAuthorDetails(author);
											return (
												<li key={author.id}>
													{author.firstName} {author.lastName}
													{details ? (
														<span className="text-stone-500"> ({details})</span>
													) : null}
												</li>
											);
										})}
									</ul>
								</dd>
							</div>
						)}
						{work.genres.length > 0 && (
							<div className="sm:col-span-2">
								<dt className="font-medium text-stone-500 text-xs uppercase tracking-wide">
									Gatunki
								</dt>
								<dd className="mt-1 text-stone-900">
									{work.genres.map((c) => c.name).join(", ")}
								</dd>
							</div>
						)}
					</dl>

					<section className="mt-10 border-stone-200 border-t pt-6">
						<h2 className="font-medium text-stone-900">Wydania</h2>
						{work.editions.length === 0 ? (
							<p className="mt-3 text-sm text-stone-500">Brak wydań.</p>
						) : (
							<div className="mt-3 overflow-x-auto border border-stone-200 bg-white">
								<table className="w-full min-w-xl text-left text-sm">
									<thead className="border-stone-200 border-b bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
										<tr>
											<th className="px-3 py-2 font-medium">Rok</th>
											<th className="px-3 py-2 font-medium">Wydawca</th>
											<th className="px-3 py-2 font-medium">Język</th>
											<th className="px-3 py-2 font-medium">Oprawa</th>
											<th className="px-3 py-2 font-medium">Strony</th>
											<th className="px-3 py-2 font-medium">EAN</th>
											<th className="px-3 py-2 font-medium">Dostępne</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-stone-200">
										{work.editions.map((edition) => (
											<tr key={edition.id}>
												<td className="px-3 py-2 text-stone-900">
													{edition.publicationYear}
												</td>
												<td className="px-3 py-2 text-stone-700">
													{edition.publisher.website ? (
														<a
															className="hover:text-teal-800 hover:underline"
															href={edition.publisher.website}
															rel="noopener noreferrer"
															target="_blank"
														>
															{edition.publisher.name}
														</a>
													) : (
														edition.publisher.name
													)}
													{edition.publisher.city ||
													edition.publisher.country ? (
														<span className="block text-stone-500 text-xs">
															{[
																edition.publisher.city,
																edition.publisher.country?.name,
															]
																.filter(Boolean)
																.join(", ")}
														</span>
													) : null}
												</td>
												<td className="px-3 py-2 text-stone-700">
													{edition.language.name}
												</td>
												<td className="px-3 py-2 text-stone-700">
													{BOOK_FORMAT_LABELS[edition.format]}
												</td>
												<td className="px-3 py-2 text-stone-700">
													{edition.pageCount}
												</td>
												<td className="px-3 py-2 font-mono text-stone-700 text-xs">
													{edition.ean}
												</td>
												<td
													className={
														edition.copiesSummary.available > 0
															? "px-3 py-2 font-medium text-teal-800"
															: "px-3 py-2 text-stone-500"
													}
												>
													{edition.copiesSummary.available}/
													{edition.copiesSummary.total}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</section>

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
							isLoggedIn={Boolean(session?.user)}
							reservationId={reservation?.id ?? null}
							workId={work.id}
						/>
					</section>
				</article>
			</main>
		</HydrateClient>
	);
}
