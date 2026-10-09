import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileForm } from "~/components/profile-form";
import { MAX_ACTIVE_LOANS } from "~/lib/loan-limits";
import { getSession } from "~/server/better-auth/server";
import { api, HydrateClient } from "~/trpc/server";

function formatDate(date: Date) {
	return new Intl.DateTimeFormat("pl-PL", {
		dateStyle: "medium",
	}).format(date);
}

export default async function AccountPage() {
	const session = await getSession();
	if (!session?.user) {
		redirect("/login");
	}

	const data = await api.user.me();
	const { user, loans, loanHistory, reservations } = data;

	return (
		<HydrateClient>
			<main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
				<h1 className="font-semibold text-2xl text-stone-900 tracking-tight">
					Moje konto
				</h1>
				<p className="mt-1 text-stone-600">
					Edycja profilu, aktywne wypożyczenia, historia oraz rezerwacje.
				</p>

				<section className="mt-8 border-stone-200 border-t pt-6">
					<h2 className="font-medium text-stone-900">Dane konta</h2>
					<ProfileForm user={user} />
				</section>

				<section className="mt-10 border-stone-200 border-t pt-6">
					<h2 className="font-medium text-stone-900">
						Aktywne wypożyczenia ({loans.length}/{MAX_ACTIVE_LOANS})
					</h2>
					{loans.length === 0 ? (
						<p className="mt-3 text-sm text-stone-500">
							Brak aktywnych wypożyczeń.
						</p>
					) : (
						<ul className="mt-3 divide-y divide-stone-200 border border-stone-200 bg-white">
							{loans.map((loan) => (
								<li className="px-4 py-3" key={loan.id}>
									<Link
										className="font-medium text-stone-900 hover:text-teal-800"
										href={`/books/${loan.book.id}`}
									>
										{loan.book.title}
									</Link>
									<p className="mt-1 text-sm text-stone-600">
										Egz. {loan.inventoryNo} · wypożyczono{" "}
										{formatDate(loan.loanedAt)} · termin{" "}
										{formatDate(loan.dueAt)}
									</p>
								</li>
							))}
						</ul>
					)}
				</section>

				<section className="mt-10 border-stone-200 border-t pt-6">
					<h2 className="font-medium text-stone-900">
						Historia wypożyczeń ({loanHistory.length})
					</h2>
					{loanHistory.length === 0 ? (
						<p className="mt-3 text-sm text-stone-500">
							Brak zwróconych wypożyczeń.
						</p>
					) : (
						<ul className="mt-3 divide-y divide-stone-200 border border-stone-200 bg-white">
							{loanHistory.map((loan) => (
								<li className="px-4 py-3" key={loan.id}>
									<Link
										className="font-medium text-stone-900 hover:text-teal-800"
										href={`/books/${loan.book.id}`}
									>
										{loan.book.title}
									</Link>
									<p className="mt-1 text-sm text-stone-600">
										Egz. {loan.inventoryNo} · wypożyczono{" "}
										{formatDate(loan.loanedAt)}
										{loan.returnedAt
											? ` · zwrócono ${formatDate(loan.returnedAt)}`
											: null}
									</p>
								</li>
							))}
						</ul>
					)}
				</section>

				<section className="mt-10 border-stone-200 border-t pt-6">
					<h2 className="font-medium text-stone-900">
						Aktywne rezerwacje ({reservations.length})
					</h2>
					{reservations.length === 0 ? (
						<p className="mt-3 text-sm text-stone-500">
							Brak aktywnych rezerwacji.
						</p>
					) : (
						<ul className="mt-3 divide-y divide-stone-200 border border-stone-200 bg-white">
							{reservations.map((reservation) => (
								<li className="px-4 py-3" key={reservation.id}>
									<Link
										className="font-medium text-stone-900 hover:text-teal-800"
										href={`/books/${reservation.book.id}`}
									>
										{reservation.book.title}
									</Link>
									<p className="mt-1 text-sm text-stone-600">
										Złożono {formatDate(reservation.createdAt)}
									</p>
								</li>
							))}
						</ul>
					)}
				</section>
			</main>
		</HydrateClient>
	);
}
