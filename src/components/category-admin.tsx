"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "~/trpc/react";

type CategoryRow = {
	id: string;
	name: string;
	booksCount: number;
};

type CategoryAdminProps = {
	items: CategoryRow[];
};

const inputClassName =
	"h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none focus:border-teal-700";

export function CategoryAdmin({ items }: CategoryAdminProps) {
	const router = useRouter();
	const [newName, setNewName] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const onError = (err: { message: string }) => {
		setMessage(null);
		setError(err.message);
	};

	const create = api.librarian.createCategory.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Dodano kategorię.");
			setNewName("");
			router.refresh();
		},
		onError,
	});

	const rename = api.librarian.renameCategory.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Zmieniono nazwę kategorii.");
			setEditingId(null);
			router.refresh();
		},
		onError,
	});

	const remove = api.librarian.deleteCategory.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Usunięto kategorię.");
			router.refresh();
		},
		onError,
	});

	const busy = create.isPending || rename.isPending || remove.isPending;

	return (
		<div className="mt-3 space-y-4">
			{error ? (
				<p className="text-red-700 text-sm" role="alert">
					{error}
				</p>
			) : null}
			{message ? (
				<p className="text-sm text-teal-800" role="status">
					{message}
				</p>
			) : null}

			<div className="overflow-x-auto border border-stone-200 bg-white">
				<table className="w-full min-w-[28rem] text-left text-sm">
					<thead className="border-stone-200 border-b bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
						<tr>
							<th className="px-3 py-2 font-medium">Nazwa</th>
							<th className="px-3 py-2 font-medium">Książki</th>
							<th className="px-3 py-2 font-medium">Akcje</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-stone-200">
						{items.map((category) => (
							<tr key={category.id}>
								<td className="px-3 py-2">
									{editingId === category.id ? (
										<input
											className={inputClassName}
											onChange={(e) => setEditName(e.target.value)}
											value={editName}
										/>
									) : (
										<span className="text-stone-900">{category.name}</span>
									)}
								</td>
								<td className="px-3 py-2 text-stone-700">
									{category.booksCount}
								</td>
								<td className="px-3 py-2">
									<div className="flex flex-wrap gap-2">
										{editingId === category.id ? (
											<>
												<button
													className="rounded-md bg-stone-900 px-2.5 py-1 font-medium text-white text-xs transition hover:bg-teal-800 disabled:opacity-50"
													disabled={busy}
													onClick={() =>
														rename.mutate({
															id: category.id,
															name: editName.trim(),
														})
													}
													type="button"
												>
													Zapisz
												</button>
												<button
													className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-stone-800 text-xs transition hover:border-teal-700 hover:text-teal-800"
													onClick={() => setEditingId(null)}
													type="button"
												>
													Anuluj
												</button>
											</>
										) : (
											<>
												<button
													className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-stone-800 text-xs transition hover:border-teal-700 hover:text-teal-800 disabled:opacity-50"
													disabled={busy}
													onClick={() => {
														setEditingId(category.id);
														setEditName(category.name);
														setError(null);
														setMessage(null);
													}}
													type="button"
												>
													Zmień nazwę
												</button>
												<button
													className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-red-800 text-xs transition hover:border-red-700 disabled:opacity-50"
													disabled={busy}
													onClick={() => {
														if (
															window.confirm(
																`Usunąć kategorię „${category.name}”?`,
															)
														) {
															remove.mutate({ id: category.id });
														}
													}}
													type="button"
												>
													Usuń
												</button>
											</>
										)}
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{items.length === 0 ? (
					<p className="px-4 py-3 text-sm text-stone-500">Brak kategorii.</p>
				) : null}
			</div>

			<form
				className="flex flex-wrap items-end gap-3"
				onSubmit={(event) => {
					event.preventDefault();
					create.mutate({ name: newName.trim() });
				}}
			>
				<label className="min-w-[14rem] flex-1">
					<span className="mb-1 block font-medium text-stone-500 text-xs uppercase tracking-wide">
						Nowa kategoria
					</span>
					<input
						className={inputClassName}
						onChange={(e) => setNewName(e.target.value)}
						required
						value={newName}
					/>
				</label>
				<button
					className="h-10 rounded-md bg-stone-900 px-4 font-medium text-sm text-white transition hover:bg-teal-800 disabled:opacity-50"
					disabled={busy}
					type="submit"
				>
					Dodaj kategorię
				</button>
			</form>
		</div>
	);
}
