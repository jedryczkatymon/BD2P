import Link from "next/link";

type LoanHistoryRow = {
	id: string;
	loanedAt: Date;
	dueAt: Date;
	returnedAt: Date;
	inventoryNo: string;
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

type LoanHistoryTableProps = {
	items: LoanHistoryRow[];
};

export function LoanHistoryTable({ items }: LoanHistoryTableProps) {
	if (items.length === 0) {
		return (
			<p className="mt-3 text-sm text-stone-500">Brak historii wypożyczeń.</p>
		);
	}

	return (
		<div className="mt-3 overflow-x-auto border border-stone-200 bg-white">
			<table className="w-full min-w-[48rem] text-left text-sm">
				<thead className="border-stone-200 border-b bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
					<tr>
						<th className="px-3 py-2 font-medium">Książka</th>
						<th className="px-3 py-2 font-medium">Egzemplarz</th>
						<th className="px-3 py-2 font-medium">Czytelnik</th>
						<th className="px-3 py-2 font-medium">Wypożyczono</th>
						<th className="px-3 py-2 font-medium">Termin</th>
						<th className="px-3 py-2 font-medium">Zwrócono</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-stone-200">
					{items.map((loan) => (
						<tr key={loan.id}>
							<td className="px-3 py-2">
								<Link
									className="font-medium text-stone-900 hover:text-teal-800"
									href={`/books/${loan.book.id}`}
								>
									{loan.book.title}
								</Link>
								<p className="text-stone-500 text-xs">EAN {loan.book.ean}</p>
							</td>
							<td className="px-3 py-2 font-mono text-stone-700">
								{loan.inventoryNo}
							</td>
							<td className="px-3 py-2">
								<p className="text-stone-900">
									{loan.user.firstName} {loan.user.lastName}
								</p>
								<p className="text-stone-500 text-xs">{loan.user.email}</p>
							</td>
							<td className="px-3 py-2 text-stone-700">
								{formatDate(loan.loanedAt)}
							</td>
							<td className="px-3 py-2 text-stone-700">
								{formatDate(loan.dueAt)}
							</td>
							<td className="px-3 py-2 text-stone-700">
								{formatDate(loan.returnedAt)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
