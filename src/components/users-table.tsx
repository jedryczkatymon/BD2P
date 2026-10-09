"use client";

import { useEffect, useRef, useState } from "react";

import { api } from "~/trpc/react";

type UserRow = {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	phone: string | null;
	pesel: string;
	role: "LIBRARIAN" | "MEMBER";
	isActive: boolean;
	activeLoans: number;
	overdueLoans: number;
};

type UsersTableProps = {
	items: UserRow[];
	currentUserId: string;
};

function roleLabel(role: UserRow["role"]) {
	return role === "LIBRARIAN" ? "Bibliotekarz" : "Czytelnik";
}

export function UsersTable({ items, currentUserId }: UsersTableProps) {
	// Optimistic overrides of `isActive`, keyed by user id.
	const [overrides, setOverrides] = useState<Record<string, boolean>>({});
	const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
	const [error, setError] = useState<string | null>(null);
	const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const setActive = api.librarian.setUserActive.useMutation();

	useEffect(() => {
		return () => {
			if (errorTimer.current) clearTimeout(errorTimer.current);
		};
	}, []);

	function showError(message: string) {
		setError(message);
		if (errorTimer.current) clearTimeout(errorTimer.current);
		errorTimer.current = setTimeout(() => setError(null), 5000);
	}

	async function toggle(user: UserRow, current: boolean) {
		if (pendingIds.has(user.id)) return;
		const next = !current;

		setError(null);
		setOverrides((prev) => ({ ...prev, [user.id]: next }));
		setPendingIds((prev) => new Set(prev).add(user.id));

		try {
			await setActive.mutateAsync({ userId: user.id, isActive: next });
		} catch (err) {
			// Roll back the optimistic change.
			setOverrides((prev) => {
				const copy = { ...prev };
				delete copy[user.id];
				return copy;
			});
			showError(
				err instanceof Error ? err.message : "Nie udało się zmienić statusu",
			);
		} finally {
			setPendingIds((prev) => {
				const copy = new Set(prev);
				copy.delete(user.id);
				return copy;
			});
		}
	}

	if (items.length === 0) {
		return <p className="mt-3 text-sm text-stone-500">Brak użytkowników.</p>;
	}

	return (
		<>
			<div className="mt-3 overflow-x-auto border border-stone-200 bg-white">
				<table className="w-full min-w-[56rem] table-fixed text-left text-sm">
					<colgroup>
						<col className="w-[24%]" />
						<col className="w-[13%]" />
						<col className="w-[13%]" />
						<col className="w-[11%]" />
						<col className="w-[15%]" />
						<col className="w-[12%]" />
						<col className="w-[12%]" />
					</colgroup>
					<thead className="border-stone-200 border-b bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
						<tr>
							<th className="px-3 py-2 font-medium">Użytkownik</th>
							<th className="px-3 py-2 font-medium">PESEL</th>
							<th className="px-3 py-2 font-medium">Telefon</th>
							<th className="px-3 py-2 font-medium">Rola</th>
							<th className="px-3 py-2 font-medium">Wypożyczenia</th>
							<th className="px-3 py-2 font-medium">Status</th>
							<th className="px-3 py-2 font-medium">Akcja</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-stone-200">
						{items.map((user) => {
							const isActive = overrides[user.id] ?? user.isActive;
							const pending = pendingIds.has(user.id);
							const canToggle =
								user.role === "MEMBER" && user.id !== currentUserId;
							return (
								<tr
									className={isActive ? undefined : "bg-stone-100/70"}
									key={user.id}
								>
									<td className="px-3 py-2">
										<p className="truncate text-stone-900">
											{user.firstName} {user.lastName}
										</p>
										<p className="truncate text-stone-500 text-xs">
											{user.email}
										</p>
									</td>
									<td className="px-3 py-2 text-stone-700 tabular-nums">
										{user.pesel}
									</td>
									<td className="px-3 py-2 text-stone-700">
										{user.phone ?? "—"}
									</td>
									<td className="px-3 py-2 text-stone-700">
										{roleLabel(user.role)}
									</td>
									<td className="px-3 py-2 text-stone-700">
										{user.activeLoans}
										{user.overdueLoans > 0 ? (
											<span className="ml-1 font-medium text-red-800">
												({user.overdueLoans} po terminie)
											</span>
										) : null}
									</td>
									<td className="px-3 py-2">
										<span
											className={
												isActive ? "text-teal-800" : "font-medium text-red-800"
											}
										>
											{isActive ? "Aktywne" : "Zablokowane"}
										</span>
									</td>
									<td className="px-3 py-2">
										{canToggle ? (
											<button
												className={`w-20 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-center text-stone-800 text-xs transition hover:border-teal-700 hover:text-teal-800 ${
													pending ? "opacity-60" : ""
												}`}
												onClick={() => void toggle(user, isActive)}
												type="button"
											>
												{isActive ? "Zablokuj" : "Aktywuj"}
											</button>
										) : (
											<span className="text-stone-400 text-xs">—</span>
										)}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{error ? (
				<div
					className="fixed right-4 bottom-4 z-50 max-w-sm rounded-md border border-red-200 bg-white px-4 py-3 text-red-700 text-sm shadow-lg"
					role="alert"
				>
					{error}
				</div>
			) : null}
		</>
	);
}
