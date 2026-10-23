"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState } from "react";

import { AddressFields } from "~/components/address-fields";
import { formatAddressLines } from "~/lib/address";
import { api } from "~/trpc/react";

type CountryOption = { code: string; name: string };

type PublisherRow = {
	id: string;
	name: string;
	street: string | null;
	postalCode: string | null;
	city: string | null;
	email: string | null;
	website: string | null;
	country: CountryOption | null;
	editionsCount: number;
};

type PublisherAdminProps = {
	items: PublisherRow[];
	countries: CountryOption[];
	/** Rendered directly under the table (e.g. pagination). */
	tableFooter?: ReactNode;
};

type PublisherFormState = {
	name: string;
	countryCode: string;
	street: string;
	postalCode: string;
	city: string;
	email: string;
	website: string;
};

const emptyForm = (): PublisherFormState => ({
	name: "",
	countryCode: "",
	street: "",
	postalCode: "",
	city: "",
	email: "",
	website: "",
});

const inputClassName =
	"h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none focus:border-teal-700";
const labelClassName =
	"mb-1 block font-medium text-stone-500 text-xs uppercase tracking-wide";

export function PublisherAdmin({
	items,
	countries,
	tableFooter,
}: PublisherAdminProps) {
	const router = useRouter();
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<PublisherFormState>(() => emptyForm());
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

	const create = api.librarian.createPublisher.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Dodano wydawnictwo.");
			resetForm();
			router.refresh();
		},
		onError,
	});

	const update = api.librarian.updatePublisher.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Zapisano dane wydawnictwa.");
			resetForm();
			router.refresh();
		},
		onError,
	});

	const remove = api.librarian.deletePublisher.useMutation({
		onSuccess: () => {
			setError(null);
			setMessage("Usunięto wydawnictwo.");
			router.refresh();
		},
		onError,
	});

	const busy = create.isPending || update.isPending || remove.isPending;

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
				<table className="w-full min-w-[44rem]t-left text-sm">
					<thead className="border-stone-200 border-b bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
						<tr>
							<th className="px-3 py-2 font-medium">Nazwa</th>
							<th className="px-3 py-2 font-medium">Siedziba</th>
							<th className="px-3 py-2 font-medium">Kontakt</th>
							<th className="px-3 py-2 font-medium">Wydania</th>
							<th className="px-3 py-2 font-medium">Akcje</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-stone-200">
						{items.map((publisher) => (
							<tr
								className={
									editingId === publisher.id ? "bg-teal-50/50" : undefined
								}
								key={publisher.id}
							>
								<td className="px-3 py-2 text-stone-900">{publisher.name}</td>
								<td className="px-3 py-2 text-stone-700">
									<PublisherSeat publisher={publisher} />
								</td>
								<td className="px-3 py-2 text-stone-700 text-xs">
									{publisher.email ? <p>{publisher.email}</p> : null}
									{publisher.website ? (
										<a
											className="text-teal-800 hover:underline"
											href={publisher.website}
											rel="noopener noreferrer"
											target="_blank"
										>
											{publisher.website}
										</a>
									) : null}
									{!publisher.email && !publisher.website ? "—" : null}
								</td>
								<td className="px-3 py-2 text-stone-700">
									{publisher.editionsCount}
								</td>
								<td className="px-3 py-2">
									<div className="flex flex-wrap gap-2">
										<button
											className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-stone-800 text-xs transition hover:border-teal-700 hover:text-teal-800 disabled:opacity-50"
											disabled={busy}
											onClick={() => {
												setEditingId(publisher.id);
												setForm({
													name: publisher.name,
													countryCode: publisher.country?.code ?? "",
													street: publisher.street ?? "",
													postalCode: publisher.postalCode ?? "",
													city: publisher.city ?? "",
													email: publisher.email ?? "",
													website: publisher.website ?? "",
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
														`Usunąć wydawnictwo „${publisher.name}”?`,
													)
												) {
													remove.mutate({ id: publisher.id });
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
					<p className="px-4 py-3 text-sm text-stone-500">Brak wydawnictw.</p>
				) : null}
			</div>

			{tableFooter ? <div>{tableFooter}</div> : null}

			<form
				className="grid gap-3 sm:grid-cols-2"
				onSubmit={(event) => {
					event.preventDefault();
					setMessage(null);
					const data = {
						name: form.name.trim(),
						countryCode: form.countryCode || null,
						street: form.street.trim() || null,
						postalCode: form.postalCode.trim() || null,
						city: form.city.trim() || null,
						email: form.email.trim() || null,
						website: form.website.trim() || null,
					};
					if (editingId) {
						update.mutate({ id: editingId, ...data });
					} else {
						create.mutate(data);
					}
				}}
				ref={formRef}
			>
				<label className="block">
					<span className={labelClassName}>Nazwa</span>
					<input
						className={inputClassName}
						onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
						required
						value={form.name}
					/>
				</label>
				<label className="block">
					<span className={labelClassName}>Kraj</span>
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
				<AddressFields
					className="sm:col-span-2"
					idPrefix="publisher"
					inputClassName={inputClassName}
					labelClassName={labelClassName}
					onChange={(address) => setForm((f) => ({ ...f, ...address }))}
					postalCodeMode={form.countryCode === "PL" ? "pl" : "any"}
					value={{
						street: form.street,
						postalCode: form.postalCode,
						city: form.city,
					}}
				/>
				<label className="block">
					<span className={labelClassName}>E-mail</span>
					<input
						className={inputClassName}
						onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
						placeholder="opcjonalnie"
						type="email"
						value={form.email}
					/>
				</label>
				<label className="block">
					<span className={labelClassName}>Strona internetowa</span>
					<input
						className={inputClassName}
						onChange={(e) =>
							setForm((f) => ({ ...f, website: e.target.value }))
						}
						placeholder="https://…"
						type="url"
						value={form.website}
					/>
				</label>
				<div className="flex flex-wrap gap-2 sm:col-span-2">
					<button
						className="h-10 rounded-md bg-stone-900 px-4 font-medium text-sm text-white transition hover:bg-teal-800 disabled:opacity-50"
						disabled={busy}
						type="submit"
					>
						{editingId ? "Zapisz wydawnictwo" : "Dodaj wydawnictwo"}
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

/** Seat column: address lines, then the country in muted text. */
function PublisherSeat({ publisher }: { publisher: PublisherRow }) {
	const lines = formatAddressLines(publisher);
	if (lines.length === 0 && !publisher.country) return <>—</>;
	return (
		<>
			{lines.map((line) => (
				<p key={line}>{line}</p>
			))}
			{publisher.country ? (
				<p className="text-stone-500 text-xs">{publisher.country.name}</p>
			) : null}
		</>
	);
}
