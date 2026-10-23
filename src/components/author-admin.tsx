"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState } from "react";

import { api } from "~/trpc/react";

type CountryOption = { code: string; name: string };
type GenreOption = { id: string; name: string };

type AuthorRow = {
	id: string;
	firstName: string;
	lastName: string;
	birthYear: number | null;
	country: CountryOption | null;
	genres: GenreOption[];
	worksCount: number;
};

type AuthorAdminProps = {
	items: AuthorRow[];
	countries: CountryOption[];
	genres: GenreOption[];
	/** Rendered directly under the table (e.g. pagination). */
	tableFooter?: ReactNode;
};

type AuthorFormState = {
	firstName: string;
	lastName: string;
	countryCode: string;
	birthYear: string;
	genreIds: string[];
};

const emptyForm = (): AuthorFormState => ({
	firstName: "",
	lastName: "",
	countryCode: "",
	birthYear: "",
	genreIds: [],
});

const inputClassName =
	"h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none focus:border-teal-700";
const labelClassName =
	"mb-1 block font-medium text-stone-500 text-xs uppercase tracking-wide";

export function AuthorAdmin({
	items,
	countries,
	genres,
	tableFooter,
}: AuthorAdminProps) {
	const router = useRouter();
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<AuthorFormState>(() => emptyForm());
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const formRef = useRef<HTMLFormElement>(null);

	const onError = (err: { message: string }) => {
		setMessage(null);
		setError(err.message);
	};

	const resetForm = () => {
		setEditingId(null);
		setForm(emptyForm());
	};

	const create = api.librarian.createAuthor.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Dodano autora.");
			resetForm();
			router.refresh();
		},
		onError,
	});

	const update = api.librarian.updateAuthor.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Zapisano dane autora.");
			resetForm();
			router.refresh();
		},
		onError,
	});

	const remove = api.librarian.deleteAuthor.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Usunięto autora.");
			router.refresh();
		},
		onError,
	});

	const busy = create.isPending || update.isPending || remove.isPending;

	function parseForm() {
		const yearText = form.birthYear.trim();
		const birthYear = yearText ? Number(yearText) : null;
		if (birthYear !== null && !Number.isInteger(birthYear)) {
			throw new Error("Nieprawidłowy rok urodzenia");
		}
		return {
			firstName: form.firstName.trim(),
			lastName: form.lastName.trim(),
			countryCode: form.countryCode || null,
			birthYear,
			genreIds: form.genreIds,
		};
	}

	function toggleId(list: string[], id: string) {
		return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
	}

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
				<table className="w-full min-w-xl text-left text-sm">
					<thead className="border-stone-200 border-b bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
						<tr>
							<th className="px-3 py-2 font-medium">Autor</th>
							<th className="px-3 py-2 font-medium">Kraj</th>
							<th className="px-3 py-2 font-medium">Rok ur.</th>
							<th className="px-3 py-2 font-medium">Gatunki</th>
							<th className="px-3 py-2 font-medium">Pozycje</th>
							<th className="px-3 py-2 font-medium">Akcje</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-stone-200">
						{items.map((author) => (
							<tr
								className={
									editingId === author.id ? "bg-teal-50/50" : undefined
								}
								key={author.id}
							>
								<td className="px-3 py-2 text-stone-900">
									{author.lastName} {author.firstName}
								</td>
								<td className="px-3 py-2 text-stone-700">
									{author.country?.name ?? "—"}
								</td>
								<td className="px-3 py-2 text-stone-700">
									{author.birthYear ?? "—"}
								</td>
								<td className="px-3 py-2 text-stone-700">
									{author.genres.length > 0
										? author.genres.map((g) => g.name).join(", ")
										: "—"}
								</td>
								<td className="px-3 py-2 text-stone-700">
									{author.worksCount}
								</td>
								<td className="px-3 py-2">
									<div className="flex flex-wrap gap-2">
										<button
											className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-stone-800 text-xs transition hover:border-teal-700 hover:text-teal-800 disabled:opacity-50"
											disabled={busy}
											onClick={() => {
												setEditingId(author.id);
												setForm({
													firstName: author.firstName,
													lastName: author.lastName,
													countryCode: author.country?.code ?? "",
													birthYear:
														author.birthYear === null
															? ""
															: String(author.birthYear),
													genreIds: author.genres.map((g) => g.id),
												});
												setError(null);
												setMessage(null);
												// The form sits below a long table.
												formRef.current?.scrollIntoView({
													behavior: "smooth",
													block: "center",
												});
												formRef.current
													?.querySelector("input")
													?.focus({ preventScroll: true });
											}}
											type="button"
										>
											Edytuj
										</button>
										<button
											className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-red-800 text-xs transition hover:border-red-700 disabled:opacity-50"
											disabled={busy}
											onClick={() => {
												if (
													window.confirm(
														`Usunąć autora „${author.firstName} ${author.lastName}”?`,
													)
												) {
													remove.mutate({ id: author.id });
												}
											}}
											type="button"
										>
											Usuń
										</button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{items.length === 0 ? (
					<p className="px-4 py-3 text-sm text-stone-500">Brak autorów.</p>
				) : null}
			</div>

			{tableFooter ? <div>{tableFooter}</div> : null}

			<form
				className="grid gap-3 sm:grid-cols-4"
				onSubmit={(event) => {
					event.preventDefault();
					try {
						const data = parseForm();
						setMessage(null);
						if (editingId) {
							update.mutate({ id: editingId, ...data });
						} else {
							create.mutate(data);
						}
					} catch (err) {
						setError(err instanceof Error ? err.message : "Błąd formularza");
					}
				}}
				ref={formRef}
			>
				<label className="block">
					<span className={labelClassName}>Imię</span>
					<input
						className={inputClassName}
						onChange={(e) =>
							setForm((f) => ({ ...f, firstName: e.target.value }))
						}
						required
						value={form.firstName}
					/>
				</label>
				<label className="block">
					<span className={labelClassName}>Nazwisko</span>
					<input
						className={inputClassName}
						onChange={(e) =>
							setForm((f) => ({ ...f, lastName: e.target.value }))
						}
						required
						value={form.lastName}
					/>
				</label>
				<label className="block">
					<span className={labelClassName}>Kraj pochodzenia</span>
					<select
						className={inputClassName}
						onChange={(e) =>
							setForm((f) => ({ ...f, countryCode: e.target.value }))
						}
						value={form.countryCode}
					>
						<option value="">nieznany</option>
						{countries.map((country) => (
							<option key={country.code} value={country.code}>
								{country.name}
							</option>
						))}
					</select>
				</label>
				<label className="block">
					<span className={labelClassName}>Rok urodzenia</span>
					<input
						className={inputClassName}
						onChange={(e) =>
							setForm((f) => ({ ...f, birthYear: e.target.value }))
						}
						placeholder="opcjonalnie"
						type="number"
						value={form.birthYear}
					/>
				</label>
				<fieldset className="sm:col-span-4">
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
				<div className="flex flex-wrap gap-2 sm:col-span-4">
					<button
						className="h-10 rounded-md bg-stone-900 px-4 font-medium text-sm text-white transition hover:bg-teal-800 disabled:opacity-50"
						disabled={busy}
						type="submit"
					>
						{editingId ? "Zapisz autora" : "Dodaj autora"}
					</button>
					{editingId ? (
						<button
							className="h-10 rounded-md border border-stone-300 bg-white px-4 text-sm text-stone-700 transition hover:border-teal-700 hover:text-teal-800"
							onClick={resetForm}
							type="button"
						>
							Anuluj edycję
						</button>
					) : null}
				</div>
			</form>
		</div>
	);
}
