import Link from "next/link";

import type { CatalogFilterValues } from "~/lib/catalog-query";

type AuthorOption = {
	id: string;
	firstName: string;
	lastName: string;
};

type NamedOption = {
	id: string;
	name: string;
};

type CatalogFiltersProps = {
	values: CatalogFilterValues;
	authors: AuthorOption[];
	publishers: NamedOption[];
	categories: NamedOption[];
};

const selectClassName =
	"rounded-md border border-stone-300 bg-white px-2.5 py-2 text-sm text-stone-900 outline-none focus:border-teal-700";

export function CatalogFilters({
	values,
	authors,
	publishers,
	categories,
}: CatalogFiltersProps) {
	const clearHref =
		values.pageSize === 50 ? "/" : `/?pageSize=${values.pageSize}`;

	return (
		<form
			action="/"
			className="flex flex-col gap-3 rounded-md border border-stone-200 bg-white p-4"
			method="get"
		>
			<input name="pageSize" type="hidden" value={values.pageSize} />

			<label className="block">
				<span className="mb-1 block font-medium text-stone-500 text-xs uppercase tracking-wide">
					Szukaj
				</span>
				<input
					autoComplete="off"
					className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-700"
					defaultValue={values.q ?? ""}
					name="q"
					placeholder="Tytuł, autor, wydawnictwo, kategoria, EAN, rok…"
					type="search"
				/>
			</label>

			<div className="flex flex-wrap items-end gap-3">
				<label className="flex min-w-[10rem] flex-1 flex-col gap-1">
					<span className="font-medium text-stone-500 text-xs uppercase tracking-wide">
						Autor
					</span>
					<select
						className={selectClassName}
						defaultValue={values.authorId ?? ""}
						name="authorId"
					>
						<option value="">Wszyscy</option>
						{authors.map((author) => (
							<option key={author.id} value={author.id}>
								{author.lastName} {author.firstName}
							</option>
						))}
					</select>
				</label>

				<label className="flex min-w-[10rem] flex-1 flex-col gap-1">
					<span className="font-medium text-stone-500 text-xs uppercase tracking-wide">
						Wydawnictwo
					</span>
					<select
						className={selectClassName}
						defaultValue={values.publisherId ?? ""}
						name="publisherId"
					>
						<option value="">Wszystkie</option>
						{publishers.map((publisher) => (
							<option key={publisher.id} value={publisher.id}>
								{publisher.name}
							</option>
						))}
					</select>
				</label>

				<label className="flex min-w-[10rem] flex-1 flex-col gap-1">
					<span className="font-medium text-stone-500 text-xs uppercase tracking-wide">
						Kategoria
					</span>
					<select
						className={selectClassName}
						defaultValue={values.categoryId ?? ""}
						name="categoryId"
					>
						<option value="">Wszystkie</option>
						{categories.map((category) => (
							<option key={category.id} value={category.id}>
								{category.name}
							</option>
						))}
					</select>
				</label>

				<label className="flex items-center gap-2 pb-2 text-sm text-stone-700">
					<input
						className="size-4 rounded border-stone-300 text-teal-800 focus:ring-teal-700"
						defaultChecked={values.availableOnly}
						name="available"
						type="checkbox"
						value="1"
					/>
					Tylko dostępne
				</label>

				<div className="flex gap-2">
					<button
						className="rounded-md bg-stone-900 px-4 py-2 font-medium text-sm text-white transition hover:bg-teal-800"
						type="submit"
					>
						Szukaj
					</button>
					<Link
						className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 transition hover:border-teal-700 hover:text-teal-800"
						href={clearHref}
					>
						Wyczyść
					</Link>
				</div>
			</div>
		</form>
	);
}
