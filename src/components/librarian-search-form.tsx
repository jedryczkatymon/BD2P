import type { ReactNode } from "react";

type LibrarianSearchFormProps = {
	actionTab: string;
	q?: string;
	pageSize: number;
	status?: string;
	section?: string;
	placeholder?: string;
	extraFields?: ReactNode;
};

export function LibrarianSearchForm({
	actionTab,
	q,
	pageSize,
	status,
	section,
	placeholder = "Szukaj…",
	extraFields,
}: LibrarianSearchFormProps) {
	return (
		<form
			action="/librarian"
			className="flex flex-wrap items-end gap-3"
			method="get"
		>
			<input name="tab" type="hidden" value={actionTab} />
			<input name="pageSize" type="hidden" value={pageSize} />
			{status ? <input name="status" type="hidden" value={status} /> : null}
			{section ? <input name="section" type="hidden" value={section} /> : null}

			<label className="min-w-[16rem] flex-1">
				<span className="mb-1 block font-medium text-stone-500 text-xs uppercase tracking-wide">
					Szukaj
				</span>
				<input
					autoComplete="off"
					className="h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none focus:border-teal-700"
					defaultValue={q ?? ""}
					name="q"
					placeholder={placeholder}
					type="search"
				/>
			</label>

			{extraFields}

			<button
				className="h-10 rounded-md bg-stone-900 px-4 font-medium text-sm text-white transition hover:bg-teal-800"
				type="submit"
			>
				Filtruj
			</button>
		</form>
	);
}
