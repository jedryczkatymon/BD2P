"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { EditionAdmin } from "~/components/edition-admin";
import { api } from "~/trpc/react";

type AuthorOption = { id: string; firstName: string; lastName: string };
type NamedOption = { id: string; name: string };
type DictionaryOption = { code: string; name: string };

type WorkListItem = {
	id: string;
	title: string;
	originalTitle: string | null;
	originalYear: number | null;
	originalLanguage: DictionaryOption;
	authors: AuthorOption[];
	editionsCount: number;
	copiesCount: number;
};

type CatalogAdminProps = {
	works: WorkListItem[];
	genres: NamedOption[];
	languages: DictionaryOption[];
	selectedWorkId?: string;
	selectedEditionId?: string;
	/** Rendered directly under the works table (e.g. pagination). */
	tableFooter?: ReactNode;
};

const inputClassName =
	"w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-teal-700";
const labelClassName =
	"mb-1 block font-medium text-stone-500 text-xs uppercase tracking-wide";

type WorkFormState = {
	title: string;
	originalTitle: string;
	description: string;
	originalYear: string;
	originalLanguageCode: string;
	authorsText: string;
	genreIds: string[];
};

const emptyForm = (): WorkFormState => ({
	title: "",
	originalTitle: "",
	description: "",
	originalYear: "",
	originalLanguageCode: "pl",
	authorsText: "",
	genreIds: [],
});

export function CatalogAdmin({
	works,
	genres,
	languages,
	selectedWorkId,
	selectedEditionId,
	tableFooter,
}: CatalogAdminProps) {
	const router = useRouter();
	const [mode, setMode] = useState<"create" | "edit">(
		selectedWorkId ? "edit" : "create",
	);
	const [selectedId, setSelectedId] = useState<string | undefined>(
		selectedWorkId,
	);
	const [form, setForm] = useState<WorkFormState>(() => emptyForm());
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const formSectionRef = useRef<HTMLElement>(null);

	const workQuery = api.librarian.getWork.useQuery(
		{ id: selectedId ?? "" },
		{ enabled: Boolean(selectedId) },
	);

	useEffect(() => {
		if (!workQuery.data || mode !== "edit") return;
		const work = workQuery.data;
		setForm({
			title: work.title,
			originalTitle: work.originalTitle ?? "",
			description: work.description ?? "",
			originalYear: work.originalYear === null ? "" : String(work.originalYear),
			originalLanguageCode: work.originalLanguage.code,
			authorsText: work.authors
				.map((a) => `${a.lastName} ${a.firstName}`)
				.join(", "),
			genreIds: work.genres.map((c) => c.id),
		});
	}, [workQuery.data, mode]);

	const refresh = () => {
		router.refresh();
		void workQuery.refetch();
	};

	const createWork = api.librarian.createWork.useMutation({
		onSuccess: (work) => {
			setError(null);
			setMessage("Dodano pozycję. Dodaj teraz jej wydanie.");
			setMode("edit");
			setSelectedId(work.id);
			router.replace(`/librarian?tab=catalog&workId=${work.id}`);
			refresh();
		},
		onError: (err) => setError(err.message),
	});

	const updateWork = api.librarian.updateWork.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Zapisano zmiany pozycji.");
			refresh();
		},
		onError: (err) => setError(err.message),
	});

	const deleteWork = api.librarian.deleteWork.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Usunięto pozycję.");
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
		const yearText = form.originalYear.trim();
		const originalYear = yearText ? Number(yearText) : null;
		if (!form.title.trim()) {
			throw new Error("Tytuł jest wymagany");
		}
		if (!form.originalLanguageCode) {
			throw new Error("Wybierz język oryginału");
		}
		if (originalYear !== null && !Number.isInteger(originalYear)) {
			throw new Error("Nieprawidłowy rok powstania");
		}
		return {
			title: form.title.trim(),
			originalTitle: form.originalTitle.trim() || null,
			description: form.description.trim() || null,
			originalYear,
			originalLanguageCode: form.originalLanguageCode,
			authors: form.authorsText.trim(),
			genreIds: form.genreIds,
		};
	}

	function toggleId(list: string[], id: string) {
		return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
	}

	return (
		<div className="mt-4 space-y-8">
			<div className="overflow-x-auto border border-stone-200 bg-white">
				<table className="w-full min-w-160 text-left text-sm">
					<thead className="border-stone-200 border-b bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
						<tr>
							<th className="px-3 py-2 font-medium">Tytuł</th>
							<th className="px-3 py-2 font-medium">Język</th>
							<th className="px-3 py-2 font-medium">Wydania</th>
							<th className="px-3 py-2 font-medium">Egz.</th>
							<th className="px-3 py-2 font-medium" />
						</tr>
					</thead>
					<tbody className="divide-y divide-stone-200">
						{works.map((work) => (
							<tr
								className={selectedId === work.id ? "bg-teal-50/50" : undefined}
								key={work.id}
							>
								<td className="px-3 py-2">
									<p className="font-medium text-stone-900">{work.title}</p>
									{work.originalTitle ? (
										<p className="text-stone-500 text-xs italic">
											{work.originalTitle}
										</p>
									) : null}
									<p className="text-stone-500 text-xs">
										{work.authors.length > 0
											? work.authors
													.map((a) => `${a.lastName} ${a.firstName}`)
													.join(", ")
											: "Autor nieznany"}
										{work.originalYear !== null
											? ` · ${work.originalYear}`
											: ""}
									</p>
								</td>
								<td className="px-3 py-2 text-stone-700">
									{work.originalLanguage.name}
								</td>
								<td className="px-3 py-2 text-stone-700">
									{work.editionsCount}
								</td>
								<td className="px-3 py-2 text-stone-700">{work.copiesCount}</td>
								<td className="px-3 py-2">
									<button
										className="text-teal-800 text-xs hover:underline"
										onClick={() => {
											setMode("edit");
											setSelectedId(work.id);
											setMessage(null);
											setError(null);
											router.replace(
												`/librarian?tab=catalog&workId=${work.id}`,
											);
											// The form sits below a long table.
											formSectionRef.current?.scrollIntoView({
												behavior: "smooth",
												block: "start",
											});
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
				{works.length === 0 ? (
					<p className="px-4 py-3 text-sm text-stone-500">Brak pozycji.</p>
				) : null}
			</div>

			{tableFooter ? <div className="mt-4">{tableFooter}</div> : null}

			<section className="border-stone-200 border-t pt-6" ref={formSectionRef}>
				<div className="mb-4 flex flex-wrap items-center gap-3">
					<h2 className="font-medium text-stone-900">
						{mode === "create" ? "Dodaj pozycję" : "Edytuj pozycję"}
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
							Nowa pozycja
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
								createWork.mutate(data);
							} else if (selectedId) {
								updateWork.mutate({ id: selectedId, ...data });
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
					<label className="block sm:col-span-2">
						<span className={labelClassName}>Tytuł oryginału</span>
						<input
							className={inputClassName}
							onChange={(e) =>
								setForm((f) => ({ ...f, originalTitle: e.target.value }))
							}
							placeholder="opcjonalnie, gdy różni się od tytułu"
							value={form.originalTitle}
						/>
					</label>
					<label className="block">
						<span className={labelClassName}>Rok powstania</span>
						<input
							className={inputClassName}
							onChange={(e) =>
								setForm((f) => ({ ...f, originalYear: e.target.value }))
							}
							placeholder="opcjonalnie"
							type="number"
							value={form.originalYear}
						/>
					</label>
					<label className="block">
						<span className={labelClassName}>Język oryginału</span>
						<select
							className={inputClassName}
							onChange={(e) =>
								setForm((f) => ({
									...f,
									originalLanguageCode: e.target.value,
								}))
							}
							required
							value={form.originalLanguageCode}
						>
							{languages.map((language) => (
								<option key={language.code} value={language.code}>
									{language.name}
								</option>
							))}
						</select>
					</label>

					<label className="block sm:col-span-2">
						<span className={labelClassName}>Opis</span>
						<textarea
							className={inputClassName}
							maxLength={5000}
							onChange={(e) =>
								setForm((f) => ({ ...f, description: e.target.value }))
							}
							placeholder="opcjonalnie"
							rows={4}
							value={form.description}
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
							value={form.authorsText}
						/>
						<span className="mt-1 block text-stone-500 text-xs">
							Format: Nazwisko Imię, kolejni autorzy po przecinku; puste pole —
							autor nieznany
						</span>
					</label>

					<fieldset className="sm:col-span-2">
						<legend className={labelClassName}>Gatunki</legend>
						<div className="mt-1 flex flex-wrap gap-3">
							{genres.map((genre) => (
								<label
									className="flex items-center gap-2 text-sm text-stone-800"
									key={genre.id}
								>
									<input
										checked={form.genreIds.includes(genre.id)}
										onChange={() =>
											setForm((f) => ({
												...f,
												genreIds: toggleId(f.genreIds, genre.id),
											}))
										}
										type="checkbox"
									/>
									{genre.name}
								</label>
							))}
						</div>
					</fieldset>

					<div className="sm:col-span-2">
						<button
							className="rounded-md bg-stone-900 px-4 py-2 font-medium text-sm text-white transition hover:bg-teal-800 disabled:opacity-50"
							disabled={createWork.isPending || updateWork.isPending}
							type="submit"
						>
							{mode === "create" ? "Dodaj pozycję" : "Zapisz zmiany"}
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
									disabled={deleteWork.isPending}
									onClick={() => {
										if (
											window.confirm(
												`Usunąć pozycję „${form.title}”? Tej operacji nie można cofnąć.`,
											)
										) {
											deleteWork.mutate({ workId: selectedId });
										}
									}}
									type="button"
								>
									Usuń pozycję
								</button>
							</>
						) : null}
					</div>
				</form>
			</section>

			{mode === "edit" && selectedId ? (
				workQuery.data ? (
					<EditionAdmin
						editions={workQuery.data.editions}
						key={selectedId}
						languages={languages}
						onChanged={refresh}
						selectedEditionId={
							selectedId === selectedWorkId ? selectedEditionId : undefined
						}
						workId={selectedId}
					/>
				) : workQuery.isLoading ? (
					<p className="text-sm text-stone-500">Ładowanie…</p>
				) : null
			) : null}
		</div>
	);
}
