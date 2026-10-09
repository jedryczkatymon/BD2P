"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "~/trpc/react";

const inputClassName =
	"h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none focus:border-teal-700";

export function CreateLoanForm() {
	const router = useRouter();
	const [inventoryNo, setInventoryNo] = useState("");
	const [userEmail, setUserEmail] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const createLoan = api.librarian.createLoan.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Wypożyczenie zarejestrowane.");
			setInventoryNo("");
			setUserEmail("");
			router.refresh();
		},
		onError: (err) => {
			setMessage(null);
			setError(err.message);
		},
	});

	return (
		<form
			className="mt-3 grid gap-3 rounded-md border border-stone-200 bg-white p-4 sm:grid-cols-3"
			onSubmit={(event) => {
				event.preventDefault();
				createLoan.mutate({
					inventoryNo: inventoryNo.trim(),
					userEmail: userEmail.trim(),
				});
			}}
		>
			<label className="block">
				<span className="mb-1 block font-medium text-stone-500 text-xs uppercase tracking-wide">
					Nr inwentarzowy
				</span>
				<input
					className={inputClassName}
					onChange={(e) => setInventoryNo(e.target.value)}
					required
					value={inventoryNo}
				/>
			</label>
			<label className="block">
				<span className="mb-1 block font-medium text-stone-500 text-xs uppercase tracking-wide">
					E-mail czytelnika
				</span>
				<input
					className={inputClassName}
					onChange={(e) => setUserEmail(e.target.value)}
					required
					type="email"
					value={userEmail}
				/>
			</label>
			<div className="flex items-end">
				<button
					className="h-10 rounded-md bg-stone-900 px-4 font-medium text-sm text-white transition hover:bg-teal-800 disabled:opacity-50"
					disabled={createLoan.isPending}
					type="submit"
				>
					Wypożycz
				</button>
			</div>
			{error ? (
				<p className="text-red-700 text-sm sm:col-span-3" role="alert">
					{error}
				</p>
			) : null}
			{message ? (
				<p className="text-sm text-teal-800 sm:col-span-3" role="status">
					{message}
				</p>
			) : null}
		</form>
	);
}
