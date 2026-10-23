"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BOOK_FORMAT_LABELS, type BookFormatValue } from "~/lib/library-rules";
import { api } from "~/trpc/react";

type DictionaryOption = { code: string; name: string };

type EditionListItem = {
	id: string;
	ean: string;
	pageCount: number;
	publicationYear: number;
	language: DictionaryOption;
	format: BookFormatValue;
	publisher: { id: string; name: string };
	copiesCount: number;
};

type EditionAdminProps = {
	workId: string;
	editions: EditionListItem[];
	languages: DictionaryOption[];
	selectedEditionId?: string;
	/** Called after any change so the parent can refetch the work. */
	onChanged: () => void;
};

const inputClassName =
	"w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-teal-700";
const labelClassName =
	"mb-1 block font-medium text-stone-500 text-xs uppercase tracking-wide";

type EditionFormState = {
	ean: string;
	pageCount: string;
	publicationYear: string;
	languageCode: string;
	format: BookFormatValue;
	publisherName: string;
};

const emptyForm = (): EditionFormState => ({
	ean: "",
	pageCount: "",
	publicationYear: String(new Date().getFullYear()),
	languageCode: "pl",
	format: "PAPERBACK",
	publisherName: "",
});

export function EditionAdmin({
	workId,
	editions,
	languages,
	selectedEditionId,
	onChanged,
}: EditionAdminProps) {
	const router = useRouter();
	const [mode, setMode] = useState<"create" | "edit">(
		selectedEditionId ? "edit" : "create",
	);
	const [selectedId, setSelectedId] = useState<string | undefined>(
		selectedEditionId,
	);
	const [form, setForm] = useState<EditionFormState>(() => emptyForm());
	const [inventoryNo, setInventoryNo] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const editionQuery = api.librarian.getEditionWithCopies.useQuery(
		{ id: selectedId ?? "" },
		{ enabled: Boolean(selectedId) },
	);

	useEffect(() => {
		if (!editionQuery.data || mode !== "edit") return;
		const edition = editionQuery.data;
		setForm({
			ean: edition.ean,
			pageCount: String(edition.pageCount),
			publicationYear: String(edition.publicationYear),
			languageCode: edition.language.code,
			format: edition.format,
			publisherName: edition.publisher.name,
		});
	}, [editionQuery.data, mode]);

	const workHref = `/librarian?tab=catalog&workId=${workId}`;

	const refresh = () => {
		onChanged();
		if (selectedId) void editionQuery.refetch();
	};

	const selectEdition = (id: string | undefined) => {
		setSelectedId(id);
		setMode(id ? "edit" : "create");
		if (!id) setForm(emptyForm());
		setMessage(null);
		setError(null);
		router.replace(id ? `${workHref}&editionId=${id}` : workHref);
	};

	const createEdition = api.librarian.createEdition.useMutation({
		onSuccess: (edition) => {
			setError(null);
			setMessage("Dodano wydanie.");
			setMode("edit");
			setSelectedId(edition.id);
			router.replace(`${workHref}&editionId=${edition.id}`);
			onChanged();
		},
		onError: (err) => setError(err.message),
	});

	const updateEdition = api.librarian.updateEdition.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Zapisano zmiany wydania.");
			refresh();
		},
		onError: (err) => setError(err.message),
	});

	const deleteEdition = api.librarian.deleteEdition.useMutation({
		onSuccess: () => {
			selectEdition(undefined);
			setMessage("Usunięto wydanie.");
			onChanged();
		},
		onError: (err) => {
			setMessage(null);
			setError(err.message);
		},
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

	function parseForm() {
		const pageCount = Number(form.pageCount);
		const publicationYear = Number(form.publicationYear);
		if (!form.ean.trim()) {
			throw new Error("EAN jest wymagany");
		}
		if (!form.publisherName.trim()) {
			throw new Error("Podaj wydawnictwo");
		}
		if (!form.languageCode) {
			throw new Error("Wybierz język wydania");
		}
		if (!Number.isInteger(pageCount) || pageCount < 1) {
			throw new Error("Nieprawidłowa liczba stron");
		}
		if (!Number.isInteger(publicationYear)) {
			throw new Error("Nieprawidłowy rok wydania");
		}
		return {
			ean: form.ean.trim(),
			pageCount,
			publicationYear,
			languageCode: form.languageCode,
			format: form.format,
			publisherName: form.publisherName.trim(),
		};
	}

	return (
		<>
			<section className="border-stone-200 border-t pt-6">
				<div className="mb-3 flex flex-wrap items-center gap-3">
					<h2 className="font-medium text-stone-900">
						Wydania ({editions.length})
					</h2>
					{mode === "edit" ? (
						<button
							className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 transition hover:border-teal-700 hover:text-teal-800"
							onClick={() => selectEdition(undefined)}
							type="button"
						>
							Nowe wydanie
						</button>
					) : null}
				</div>

				<div className="overflow-x-auto border border-stone-200 bg-white">
					<table className="w-full min-w-xl text-left text-sm">
						<thead className="border-stone-200 border-b bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
							<tr>
								<th className="px-3 py-2 font-medium">Rok</th>
								<th className="px-3 py-2 font-medium">Wydawca</th>
								<th className="px-3 py-2 font-medium">Język</th>
								<th className="px-3 py-2 font-medium">Oprawa</th>
								<th className="px-3 py-2 font-medium">EAN</th>
								<th className="px-3 py-2 font-medium">Egz.</th>
								<th className="px-3 py-2 font-medium" />
							</tr>
						</thead>
						<tbody className="divide-y divide-stone-200">
							{editions.map((edition) => (
								<tr
									className={
										selectedId === edition.id ? "bg-teal-50/50" : undefined
									}
									key={edition.id}
								>
									<td className="px-3 py-2 text-stone-900">
										{edition.publicationYear}
									</td>
									<td className="px-3 py-2 text-stone-700">
										{edition.publisher.name}
									</td>
									<td className="px-3 py-2 text-stone-700">
										{edition.language.name}
									</td>
									<td className="px-3 py-2 text-stone-700">
										{BOOK_FORMAT_LABELS[edition.format]}
									</td>
									<td className="px-3 py-2 font-mono text-stone-700 text-xs">
										{edition.ean}
									</td>
									<td className="px-3 py-2 text-stone-700">
										{edition.copiesCount}
									</td>
									<td className="px-3 py-2">
										<button
											className="text-teal-800 text-xs hover:underline"
											onClick={() => selectEdition(edition.id)}
											type="button"
										>
											Edytuj
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{editions.length === 0 ? (
						<p className="px-4 py-3 text-sm text-stone-500">Brak wydań.</p>
					) : null}
				</div>
			</section>

			<section className="border-stone-200 border-t pt-6">
				<h2 className="mb-4 font-medium text-stone-900">
					{mode === "create" ? "Dodaj wydanie" : "Edytuj wydanie"}
				</h2>

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
								createEdition.mutate({ workId, ...data });
							} else if (selectedId) {
								updateEdition.mutate({ id: selectedId, ...data });
							}
						} catch (err) {
							setError(err instanceof Error ? err.message : "Błąd formularza");
						}
					}}
				>
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
					<label className="block">
						<span className={labelClassName}>Język wydania</span>
						<select
							className={inputClassName}
							onChange={(e) =>
								setForm((f) => ({ ...f, languageCode: e.target.value }))
							}
							required
							value={form.languageCode}
						>
							{languages.map((language) => (
								<option key={language.code} value={language.code}>
									{language.name}
								</option>
							))}
						</select>
					</label>
					<label className="block">
						<span className={labelClassName}>Oprawa</span>
						<select
							className={inputClassName}
							onChange={(e) =>
								setForm((f) => ({
									...f,
									format: e.target.value as BookFormatValue,
								}))
							}
							value={form.format}
						>
							{Object.entries(BOOK_FORMAT_LABELS).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
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

					<div className="sm:col-span-2">
						<button
							className="rounded-md bg-stone-900 px-4 py-2 font-medium text-sm text-white transition hover:bg-teal-800 disabled:opacity-50"
							disabled={createEdition.isPending || updateEdition.isPending}
							type="submit"
						>
							{mode === "create" ? "Dodaj wydanie" : "Zapisz wydanie"}
						</button>
						{selectedId && mode === "edit" ? (
							<button
								className="ml-3 rounded-md border border-stone-300 bg-white px-3 py-2 text-red-800 text-sm transition hover:border-red-700 disabled:opacity-50"
								disabled={deleteEdition.isPending}
								onClick={() => {
									if (
										window.confirm(
											`Usunąć wydanie EAN ${form.ean}? Tej operacji nie można cofnąć.`,
										)
									) {
										deleteEdition.mutate({ editionId: selectedId });
									}
								}}
								type="button"
							>
								Usuń wydanie
							</button>
						) : null}
					</div>
				</form>
			</section>

			{mode === "edit" && selectedId ? (
				<section className="border-stone-200 border-t pt-6">
					<h2 className="font-medium text-stone-900">Egzemplarze wydania</h2>
					{editionQuery.isLoading ? (
						<p className="mt-2 text-sm text-stone-500">Ładowanie…</p>
					) : null}
					{editionQuery.data ? (
						<>
							<div className="mt-3 overflow-x-auto border border-stone-200 bg-white">
								<table className="w-full min-w-md text-left text-sm">
									<thead className="border-stone-200 border-b bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
										<tr>
											<th className="px-3 py-2 font-medium">Nr inwentarzowy</th>
											<th className="px-3 py-2 font-medium">Status</th>
											<th className="px-3 py-2 font-medium">Zmiana statusu</th>
											<th className="px-3 py-2 font-medium" />
										</tr>
									</thead>
									<tbody className="divide-y divide-stone-200">
										{editionQuery.data.copies.map((copy) => (
											<tr key={copy.id}>
												<td className="px-3 py-2 font-mono text-stone-800">
													{copy.inventoryNo}
												</td>
												<td className="px-3 py-2 text-stone-700">
													{copy.status}
													{copy.onLoan ? (
														<span className="ml-2 text-amber-700 text-xs">
															wypożyczony
														</span>
													) : null}
												</td>
												<td className="px-3 py-2">
													{copy.onLoan ? (
														<span className="text-stone-400 text-xs">
															po zwrocie
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
								{editionQuery.data.copies.length === 0 ? (
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
										editionId: selectedId,
										inventoryNo: inventoryNo.trim(),
									});
								}}
							>
								<label className="min-w-48 flex-1">
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
		</>
	);
}
