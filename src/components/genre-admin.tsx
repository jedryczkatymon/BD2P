"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "~/trpc/react";

type GenreRow = {
	id: string;
	name: string;
	worksCount: number;
};

type GenreAdminProps = {
	items: GenreRow[];
};

const inputClassName =
	"h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none focus:border-teal-700";

export function GenreAdmin({ items }: GenreAdminProps) {
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

	const create = api.librarian.createGenre.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Dodano gatunek.");
			setNewName("");
			router.refresh();
		},
		onError,
	});

	const rename = api.librarian.renameGenre.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Zmieniono nazwę gatunku.");
			setEditingId(null);
			router.refresh();
		},
		onError,
	});

	const remove = api.librarian.deleteGenre.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Usunięto gatunek.");
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
				<table className="w-full min-w-md text-left text-sm">
					<thead className="border-stone-200 border-b bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
						<tr>
							<th className="px-3 py-2 font-medium">Nazwa</th>
							<th className="px-3 py-2 font-medium">Pozycje</th>
							<th className="px-3 py-2 font-medium">Akcje</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-stone-200">
						{items.map((genre) => (
							<tr key={genre.id}>
								<td className="px-3 py-2">
									{editingId === genre.id ? (
										<input
											className={inputClassName}
											onChange={(e) => setEditName(e.target.value)}
											value={editName}
										/>
									) : (
										<span className="text-stone-900">{genre.name}</span>
									)}
								</td>
								<td className="px-3 py-2 text-stone-700">{genre.worksCount}</td>
								<td className="px-3 py-2">
									<div className="flex flex-wrap gap-2">
										{editingId === genre.id ? (
											<>
												<button
													className="rounded-md bg-stone-900 px-2.5 py-1 font-medium text-white text-xs transition hover:bg-teal-800 disabled:opacity-50"
													disabled={busy}
													onClick={() =>
														rename.mutate({
															id: genre.id,
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
														setEditingId(genre.id);
														setEditName(genre.name);
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
															window.confirm(`Usunąć gatunek „${genre.name}”?`)
														) {
															remove.mutate({ id: genre.id });
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
					<p className="px-4 py-3 text-sm text-stone-500">Brak gatunków.</p>
				) : null}
			</div>

			<form
				className="flex flex-wrap items-end gap-3"
				onSubmit={(event) => {
					event.preventDefault();
					create.mutate({ name: newName.trim() });
				}}
			>
				<label className="min-w-56 flex-1">
					<span className="mb-1 block font-medium text-stone-500 text-xs uppercase tracking-wide">
						Nowy gatunek
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
					Dodaj gatunek
				</button>
			</form>
		</div>
	);
}
