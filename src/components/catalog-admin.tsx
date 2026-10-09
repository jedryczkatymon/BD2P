"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { api } from "~/trpc/react";

type AuthorOption = { id: string; firstName: string; lastName: string };
type NamedOption = { id: string; name: string };

type BookListItem = {
	id: string;
	title: string;
	ean: string;
	pageCount: number;
	publicationYear: number;
	publisher: { id: string; name: string };
	authors: AuthorOption[];
	copiesCount: number;
};

type CatalogAdminProps = {
	books: BookListItem[];
	categories: NamedOption[];
	selectedBookId?: string;
	/** Rendered directly under the books table (e.g. pagination). */
	tableFooter?: ReactNode;
};

const inputClassName =
	"w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-teal-700";
const labelClassName =
	"mb-1 block font-medium text-stone-500 text-xs uppercase tracking-wide";

type BookFormState = {
	title: string;
	ean: string;
	pageCount: string;
	publicationYear: string;
	publisherName: string;
	authorsText: string;
	categoryIds: string[];
};

const emptyForm = (): BookFormState => ({
	title: "",
	ean: "",
	pageCount: "",
	publicationYear: String(new Date().getFullYear()),
	publisherName: "",
	authorsText: "",
	categoryIds: [],
});

export function CatalogAdmin({
	books,
	categories,
	selectedBookId,
	tableFooter,
}: CatalogAdminProps) {
	const router = useRouter();
	const [mode, setMode] = useState<"create" | "edit">(
		selectedBookId ? "edit" : "create",
	);
	const [selectedId, setSelectedId] = useState<string | undefined>(
		selectedBookId,
	);
	const [form, setForm] = useState<BookFormState>(() => emptyForm());
	const [inventoryNo, setInventoryNo] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const bookQuery = api.librarian.getBookWithCopies.useQuery(
		{ id: selectedId ?? "" },
		{ enabled: Boolean(selectedId) },
	);

	useEffect(() => {
		if (!bookQuery.data || mode !== "edit") return;
		const book = bookQuery.data;
		setForm({
			title: book.title,
			ean: book.ean,
			pageCount: String(book.pageCount),
			publicationYear: String(book.publicationYear),
			publisherName: book.publisher.name,
			authorsText: book.authors
				.map((a) => `${a.lastName} ${a.firstName}`)
				.join(", "),
			categoryIds: book.categories.map((c) => c.id),
		});
	}, [bookQuery.data, mode]);

	const refresh = () => {
		router.refresh();
		void bookQuery.refetch();
	};

	const createBook = api.librarian.createBook.useMutation({
		onSuccess: (book) => {
			setError(null);
			setMessage("Dodano książkę.");
			setMode("edit");
			setSelectedId(book.id);
			router.replace(`/librarian?tab=catalog&bookId=${book.id}`);
			refresh();
		},
		onError: (err) => setError(err.message),
	});

	const updateBook = api.librarian.updateBook.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Zapisano zmiany książki.");
			refresh();
		},
		onError: (err) => setError(err.message),
	});

	const addCopy = api.librarian.addCopy.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Dodano egzemplarz.");
			setInventoryNo("");
			refresh();
		},
		onError: (err) => setError(err.message),
	});

	const updateCopyStatus = api.librarian.updateCopyStatus.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Zaktualizowano status egzemplarza.");
			refresh();
		},
		onError: (err) => setError(err.message),
	});

	const deleteCopy = api.librarian.deleteCopy.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Usunięto egzemplarz.");
			refresh();
		},
		onError: (err) => {
			setMessage(null);
			setError(err.message);
		},
	});

	const deleteBook = api.librarian.deleteBook.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Usunięto książkę.");
			setMode("create");
			setSelectedId(undefined);
			setForm(emptyForm());
			router.replace("/librarian?tab=catalog");
			router.refresh();
		},
		onError: (err) => {
			setMessage(null);
			setError(err.message);
		},
	});

	function parseForm() {
		const pageCount = Number(form.pageCount);
		const publicationYear = Number(form.publicationYear);
		if (!form.title.trim() || !form.ean.trim()) {
			throw new Error("Tytuł i EAN są wymagane");
		}
		if (!form.publisherName.trim()) {
			throw new Error("Podaj wydawnictwo");
		}
		if (!form.authorsText.trim()) {
			throw new Error("Podaj co najmniej jednego autora (Nazwisko Imię)");
		}
		if (!Number.isInteger(pageCount) || pageCount < 1) {
			throw new Error("Nieprawidłowa liczba stron");
		}
		if (!Number.isInteger(publicationYear)) {
			throw new Error("Nieprawidłowy rok wydania");
		}
		return {
			title: form.title.trim(),
			ean: form.ean.trim(),
			pageCount,
			publicationYear,
			publisherName: form.publisherName.trim(),
			authors: form.authorsText.trim(),
			categoryIds: form.categoryIds,
		};
	}

	function toggleId(list: string[], id: string) {
		return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
	}

	return (
		<div className="mt-4 space-y-8">
			<div className="overflow-x-auto border border-stone-200 bg-white">
				<table className="w-full min-w-[40rem] text-left text-sm">
					<thead className="border-stone-200 border-b bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
						<tr>
							<th className="px-3 py-2 font-medium">Tytuł</th>
							<th className="px-3 py-2 font-medium">EAN</th>
							<th className="px-3 py-2 font-medium">Wydawca</th>
							<th className="px-3 py-2 font-medium">Egz.</th>
							<th className="px-3 py-2 font-medium" />
						</tr>
					</thead>
					<tbody className="divide-y divide-stone-200">
						{books.map((book) => (
							<tr
								className={selectedId === book.id ? "bg-teal-50/50" : undefined}
								key={book.id}
							>
								<td className="px-3 py-2">
									<p className="font-medium text-stone-900">{book.title}</p>
									<p className="text-stone-500 text-xs">
										{book.authors
											.map((a) => `${a.lastName} ${a.firstName}`)
											.join(", ")}{" "}
										· {book.publicationYear}
									</p>
								</td>
								<td className="px-3 py-2 font-mono text-stone-700 text-xs">
									{book.ean}
								</td>
								<td className="px-3 py-2 text-stone-700">
									{book.publisher.name}
								</td>
								<td className="px-3 py-2 text-stone-700">{book.copiesCount}</td>
								<td className="px-3 py-2">
									<button
										className="text-teal-800 text-xs hover:underline"
										onClick={() => {
											setMode("edit");
											setSelectedId(book.id);
											setMessage(null);
											setError(null);
											router.replace(
												`/librarian?tab=catalog&bookId=${book.id}`,
											);
										}}
										type="button"
									>
										Edytuj
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{books.length === 0 ? (
					<p className="px-4 py-3 text-sm text-stone-500">Brak książek.</p>
				) : null}
			</div>

			{tableFooter ? <div className="mt-4">{tableFooter}</div> : null}

			<section className="border-stone-200 border-t pt-6">
				<div className="mb-4 flex flex-wrap items-center gap-3">
					<h2 className="font-medium text-stone-900">
						{mode === "create" ? "Dodaj książkę" : "Edytuj książkę"}
					</h2>
					{mode === "edit" ? (
						<button
							className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 transition hover:border-teal-700 hover:text-teal-800"
							onClick={() => {
								setMode("create");
								setSelectedId(undefined);
								setForm(emptyForm());
								setMessage(null);
								setError(null);
								router.replace("/librarian?tab=catalog");
							}}
							type="button"
						>
							Nowa książka
						</button>
					) : null}
				</div>

				{error ? (
					<p className="mb-3 text-red-700 text-sm" role="alert">
						{error}
					</p>
				) : null}
				{message ? (
					<p className="mb-3 text-sm text-teal-800" role="status">
						{message}
					</p>
				) : null}

				<form
					className="grid gap-3 sm:grid-cols-2"
					onSubmit={(event) => {
						event.preventDefault();
						try {
							const data = parseForm();
							setMessage(null);
							if (mode === "create") {
								createBook.mutate(data);
							} else if (selectedId) {
								updateBook.mutate({ id: selectedId, ...data });
							}
						} catch (err) {
							setError(err instanceof Error ? err.message : "Błąd formularza");
						}
					}}
				>
					<label className="block sm:col-span-2">
						<span className={labelClassName}>Tytuł</span>
						<input
							className={inputClassName}
							onChange={(e) =>
								setForm((f) => ({ ...f, title: e.target.value }))
							}
							required
							value={form.title}
						/>
					</label>
					<label className="block">
						<span className={labelClassName}>EAN</span>
						<input
							className={inputClassName}
							onChange={(e) => setForm((f) => ({ ...f, ean: e.target.value }))}
							required
							value={form.ean}
						/>
					</label>
					<label className="block">
						<span className={labelClassName}>Wydawnictwo</span>
						<input
							className={inputClassName}
							onChange={(e) =>
								setForm((f) => ({ ...f, publisherName: e.target.value }))
							}
							required
							value={form.publisherName}
						/>
					</label>
					<label className="block">
						<span className={labelClassName}>Liczba stron</span>
						<input
							className={inputClassName}
							min={1}
							onChange={(e) =>
								setForm((f) => ({ ...f, pageCount: e.target.value }))
							}
							required
							type="number"
							value={form.pageCount}
						/>
					</label>
					<label className="block">
						<span className={labelClassName}>Rok wydania</span>
						<input
							className={inputClassName}
							onChange={(e) =>
								setForm((f) => ({ ...f, publicationYear: e.target.value }))
							}
							required
							type="number"
							value={form.publicationYear}
						/>
					</label>

					<label className="block sm:col-span-2">
						<span className={labelClassName}>Autorzy</span>
						<input
							className={inputClassName}
							onChange={(e) =>
								setForm((f) => ({ ...f, authorsText: e.target.value }))
							}
							placeholder="Kowalski Jan, Nowak Anna"
							required
							value={form.authorsText}
						/>
						<span className="mt-1 block text-stone-500 text-xs">
							Format: Nazwisko Imię, kolejni autorzy po przecinku
						</span>
					</label>

					<fieldset className="sm:col-span-2">
						<legend className={labelClassName}>Kategorie</legend>
						<div className="mt-1 flex flex-wrap gap-3">
							{categories.map((category) => (
								<label
									className="flex items-center gap-2 text-sm text-stone-800"
									key={category.id}
								>
									<input
										checked={form.categoryIds.includes(category.id)}
										onChange={() =>
											setForm((f) => ({
												...f,
												categoryIds: toggleId(f.categoryIds, category.id),
											}))
										}
										type="checkbox"
									/>
									{category.name}
								</label>
							))}
						</div>
					</fieldset>

					<div className="sm:col-span-2">
						<button
							className="rounded-md bg-stone-900 px-4 py-2 font-medium text-sm text-white transition hover:bg-teal-800 disabled:opacity-50"
							disabled={createBook.isPending || updateBook.isPending}
							type="submit"
						>
							{mode === "create" ? "Dodaj książkę" : "Zapisz zmiany"}
						</button>
						{selectedId && mode === "edit" ? (
							<>
								<Link
									className="ml-3 text-sm text-teal-800 hover:underline"
									href={`/books/${selectedId}`}
								>
									Podgląd publiczny
								</Link>
								<button
									className="ml-3 rounded-md border border-stone-300 bg-white px-3 py-2 text-red-800 text-sm transition hover:border-red-700 disabled:opacity-50"
									disabled={deleteBook.isPending}
									onClick={() => {
										if (
											window.confirm(
												`Usunąć książkę „${form.title}”? Tej operacji nie można cofnąć.`,
											)
										) {
											deleteBook.mutate({ bookId: selectedId });
										}
									}}
									type="button"
								>
									Usuń książkę
								</button>
							</>
						) : null}
					</div>
				</form>
			</section>

			{mode === "edit" && selectedId ? (
				<section className="border-stone-200 border-t pt-6">
					<h2 className="font-medium text-stone-900">Egzemplarze</h2>
					{bookQuery.isLoading ? (
						<p className="mt-2 text-sm text-stone-500">Ładowanie…</p>
					) : null}
					{bookQuery.data ? (
						<>
							<div className="mt-3 overflow-x-auto border border-stone-200 bg-white">
								<table className="w-full min-w-[28rem] text-left text-sm">
									<thead className="border-stone-200 border-b bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
										<tr>
											<th className="px-3 py-2 font-medium">Nr inwentarzowy</th>
											<th className="px-3 py-2 font-medium">Status</th>
											<th className="px-3 py-2 font-medium">Zmiana statusu</th>
											<th className="px-3 py-2 font-medium" />
										</tr>
									</thead>
									<tbody className="divide-y divide-stone-200">
										{bookQuery.data.copies.map((copy) => (
											<tr key={copy.id}>
												<td className="px-3 py-2 font-mono text-stone-800">
													{copy.inventoryNo}
												</td>
												<td className="px-3 py-2 text-stone-700">
													{copy.status}
												</td>
												<td className="px-3 py-2">
													{copy.status === "LOANED" ? (
														<span className="text-stone-400 text-xs">
															tylko przez zwrot
														</span>
													) : (
														<select
															className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs"
															defaultValue={copy.status}
															disabled={updateCopyStatus.isPending}
															onChange={(e) => {
																const status = e.target.value as
																	| "AVAILABLE"
																	| "LOST"
																	| "MAINTENANCE";
																if (status === copy.status) return;
																updateCopyStatus.mutate({
																	copyId: copy.id,
																	status,
																});
															}}
														>
															<option value="AVAILABLE">AVAILABLE</option>
															<option value="LOST">LOST</option>
															<option value="MAINTENANCE">MAINTENANCE</option>
														</select>
													)}
												</td>
												<td className="px-3 py-2">
													<button
														className="text-red-800 text-xs hover:underline disabled:opacity-50"
														disabled={deleteCopy.isPending}
														onClick={() => {
															if (
																window.confirm(
																	`Usunąć egzemplarz ${copy.inventoryNo}?`,
																)
															) {
																deleteCopy.mutate({ copyId: copy.id });
															}
														}}
														type="button"
													>
														Usuń
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
								{bookQuery.data.copies.length === 0 ? (
									<p className="px-4 py-3 text-sm text-stone-500">
										Brak egzemplarzy.
									</p>
								) : null}
							</div>

							<form
								className="mt-4 flex flex-wrap items-end gap-3"
								onSubmit={(event) => {
									event.preventDefault();
									addCopy.mutate({
										bookId: selectedId,
										inventoryNo: inventoryNo.trim(),
									});
								}}
							>
								<label className="min-w-[12rem] flex-1">
									<span className={labelClassName}>Nowy nr inwentarzowy</span>
									<input
										className={inputClassName}
										onChange={(e) => setInventoryNo(e.target.value)}
										required
										value={inventoryNo}
									/>
								</label>
								<button
									className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm text-stone-800 transition hover:border-teal-700 hover:text-teal-800 disabled:opacity-50"
									disabled={addCopy.isPending}
									type="submit"
								>
									Dodaj egzemplarz
								</button>
							</form>
						</>
					) : null}
				</section>
			) : null}
		</div>
	);
}
