"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "~/trpc/react";

type ReservationRow = {
	id: string;
	createdAt: Date;
	user: {
		id: string;
		email: string;
		firstName: string;
		lastName: string;
	};
	book: { id: string; title: string; ean: string };
};

function formatDate(date: Date) {
	return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(date);
}

type ActiveReservationsTableProps = {
	items: ReservationRow[];
};

export function ActiveReservationsTable({
	items,
}: ActiveReservationsTableProps) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pendingId, setPendingId] = useState<string | null>(null);

	const onDone = () => {
		setError(null);
		setPendingId(null);
		router.refresh();
	};

	const cancel = api.librarian.cancelReservation.useMutation({
		onSuccess: onDone,
		onError: (err) => {
			setPendingId(null);
			setError(err.message);
		},
	});

	const fulfill = api.librarian.fulfillReservation.useMutation({
		onSuccess: onDone,
		onError: (err) => {
			setPendingId(null);
			setError(err.message);
		},
	});

	if (items.length === 0) {
		return (
			<p className="mt-3 text-sm text-stone-500">Brak aktywnych rezerwacji.</p>
		);
	}

	const busy = cancel.isPending || fulfill.isPending;

	return (
		<div className="mt-3 overflow-x-auto border border-stone-200 bg-white">
			{error ? (
				<p className="border-stone-200 border-b px-4 py-2 text-red-700 text-sm">
					{error}
				</p>
			) : null}
			<table className="w-full min-w-[44rem] text-left text-sm">
				<thead className="border-stone-200 border-b bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
					<tr>
						<th className="px-3 py-2 font-medium">Książka</th>
						<th className="px-3 py-2 font-medium">Czytelnik</th>
						<th className="px-3 py-2 font-medium">Złożono</th>
						<th className="px-3 py-2 font-medium">Akcje</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-stone-200">
					{items.map((reservation) => (
						<tr key={reservation.id}>
							<td className="px-3 py-2">
								<Link
									className="font-medium text-stone-900 hover:text-teal-800"
									href={`/books/${reservation.book.id}`}
								>
									{reservation.book.title}
								</Link>
								<p className="text-stone-500 text-xs">
									EAN {reservation.book.ean}
								</p>
							</td>
							<td className="px-3 py-2">
								<p className="text-stone-900">
									{reservation.user.firstName} {reservation.user.lastName}
								</p>
								<p className="text-stone-500 text-xs">
									{reservation.user.email}
								</p>
							</td>
							<td className="px-3 py-2 text-stone-700">
								{formatDate(reservation.createdAt)}
							</td>
							<td className="px-3 py-2">
								<div className="flex flex-wrap gap-2">
									<button
										className="rounded-md bg-stone-900 px-2.5 py-1 font-medium text-white text-xs transition hover:bg-teal-800 disabled:opacity-50"
										disabled={pendingId === reservation.id || busy}
										onClick={() => {
											setPendingId(reservation.id);
											fulfill.mutate({ reservationId: reservation.id });
										}}
										type="button"
									>
										Zrealizuj
									</button>
									<button
										className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-stone-800 text-xs transition hover:border-teal-700 hover:text-teal-800 disabled:opacity-50"
										disabled={pendingId === reservation.id || busy}
										onClick={() => {
											setPendingId(reservation.id);
											cancel.mutate({ reservationId: reservation.id });
										}}
										type="button"
									>
										Anuluj
									</button>
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
