"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "~/trpc/react";

type LoanRow = {
	id: string;
	loanedAt: Date;
	dueAt: Date;
	overdue: boolean;
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

type ActiveLoansTableProps = {
	items: LoanRow[];
};

export function ActiveLoansTable({ items }: ActiveLoansTableProps) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pendingId, setPendingId] = useState<string | null>(null);

	const returnLoan = api.librarian.returnLoan.useMutation({
		onSuccess: () => {
			setError(null);
			setPendingId(null);
			router.refresh();
		},
		onError: (err) => {
			setPendingId(null);
			setError(err.message);
		},
	});

	if (items.length === 0) {
		return (
			<p className="mt-3 text-sm text-stone-500">Brak aktywnych wypożyczeń.</p>
		);
	}

	return (
		<div className="mt-3 overflow-x-auto border border-stone-200 bg-white">
			{error ? (
				<p className="border-stone-200 border-b px-4 py-2 text-red-700 text-sm">
					{error}
				</p>
			) : null}
			<table className="w-full min-w-[48rem] text-left text-sm">
				<thead className="border-stone-200 border-b bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
					<tr>
						<th className="px-3 py-2 font-medium">Książka</th>
						<th className="px-3 py-2 font-medium">Egzemplarz</th>
						<th className="px-3 py-2 font-medium">Czytelnik</th>
						<th className="px-3 py-2 font-medium">Wypożyczono</th>
						<th className="px-3 py-2 font-medium">Termin</th>
						<th className="px-3 py-2 font-medium">Akcja</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-stone-200">
					{items.map((loan) => (
						<tr
							className={loan.overdue ? "bg-red-50/60" : undefined}
							key={loan.id}
						>
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
							<td className="px-3 py-2">
								<span
									className={
										loan.overdue ? "font-medium text-red-800" : "text-stone-700"
									}
								>
									{formatDate(loan.dueAt)}
									{loan.overdue ? " (po terminie)" : null}
								</span>
							</td>
							<td className="px-3 py-2">
								<button
									className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-stone-800 text-xs transition hover:border-teal-700 hover:text-teal-800 disabled:opacity-50"
									disabled={pendingId === loan.id || returnLoan.isPending}
									onClick={() => {
										setPendingId(loan.id);
										returnLoan.mutate({ loanId: loan.id });
									}}
									type="button"
								>
									{pendingId === loan.id ? "…" : "Zwrot"}
								</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
