import Link from "next/link";

type HistoryRow = {
	id: string;
	status: "FULFILLED" | "CANCELLED" | "PENDING";
	createdAt: Date;
	updatedAt: Date;
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

function statusLabel(status: HistoryRow["status"]) {
	if (status === "FULFILLED") return "Zrealizowana";
	if (status === "CANCELLED") return "Anulowana";
	return status;
}

type ReservationHistoryTableProps = {
	items: HistoryRow[];
};

export function ReservationHistoryTable({
	items,
}: ReservationHistoryTableProps) {
	if (items.length === 0) {
		return (
			<p className="mt-3 text-sm text-stone-500">Brak historii rezerwacji.</p>
		);
	}

	return (
		<div className="mt-3 overflow-x-auto border border-stone-200 bg-white">
			<table className="w-full min-w-[44rem] text-left text-sm">
				<thead className="border-stone-200 border-b bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
					<tr>
						<th className="px-3 py-2 font-medium">Książka</th>
						<th className="px-3 py-2 font-medium">Czytelnik</th>
						<th className="px-3 py-2 font-medium">Status</th>
						<th className="px-3 py-2 font-medium">Złożono</th>
						<th className="px-3 py-2 font-medium">Aktualizacja</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-stone-200">
					{items.map((row) => (
						<tr key={row.id}>
							<td className="px-3 py-2">
								<Link
									className="font-medium text-stone-900 hover:text-teal-800"
									href={`/books/${row.book.id}`}
								>
									{row.book.title}
								</Link>
								<p className="text-stone-500 text-xs">EAN {row.book.ean}</p>
							</td>
							<td className="px-3 py-2">
								<p className="text-stone-900">
									{row.user.firstName} {row.user.lastName}
								</p>
								<p className="text-stone-500 text-xs">{row.user.email}</p>
							</td>
							<td className="px-3 py-2 text-stone-700">
								{statusLabel(row.status)}
							</td>
							<td className="px-3 py-2 text-stone-700">
								{formatDate(row.createdAt)}
							</td>
							<td className="px-3 py-2 text-stone-700">
								{formatDate(row.updatedAt)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
