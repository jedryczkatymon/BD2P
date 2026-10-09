import Link from "next/link";

import {
	buildLibrarianHref,
	CATALOG_PAGE_SIZES,
	type LibrarianListFilters,
	type LibrarianPageParam,
	type LibrarianTab,
	type PageSize,
} from "~/lib/librarian-query";

type LibrarianPaginationProps = {
	tab: LibrarianTab;
	page: number;
	pageSize: PageSize;
	total: number;
	filters: Omit<LibrarianListFilters, "pageSize"> & { pageSize: PageSize };
	emptyLabel?: string;
	pageParam?: LibrarianPageParam;
};

export function LibrarianPagination({
	tab,
	page,
	pageSize,
	total,
	filters,
	emptyLabel = "Brak wyników",
	pageParam = "page",
}: LibrarianPaginationProps) {
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const safePage = Math.min(page, totalPages);
	const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
	const to = Math.min(safePage * pageSize, total);

	function href(nextPage: number, nextSize: number = pageSize) {
		return buildLibrarianHref(
			tab,
			nextPage,
			{
				...filters,
				pageSize: nextSize as PageSize,
			},
			pageParam,
		);
	}

	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<p className="text-sm text-stone-600">
				{total === 0 ? emptyLabel : `Wyświetlanie ${from}–${to} z ${total}`}
			</p>

			<div className="flex flex-wrap items-center gap-4">
				<div className="flex items-center gap-2 text-sm text-stone-600">
					<span>Na stronę</span>
					<div className="flex overflow-hidden rounded-md border border-stone-300 bg-white">
						{CATALOG_PAGE_SIZES.map((size) => (
							<Link
								className={
									size === pageSize
										? "bg-stone-900 px-2.5 py-1.5 font-medium text-white"
										: "px-2.5 py-1.5 text-stone-700 transition hover:bg-stone-100"
								}
								href={href(1, size)}
								key={size}
							>
								{size}
							</Link>
						))}
					</div>
				</div>

				<div className="flex items-center gap-2">
					{safePage > 1 ? (
						<Link
							className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 transition hover:border-teal-700 hover:text-teal-800"
							href={href(safePage - 1)}
						>
							Poprzednia
						</Link>
					) : (
						<span className="rounded-md border border-stone-200 px-3 py-1.5 text-sm text-stone-300">
							Poprzednia
						</span>
					)}
					<span className="text-sm text-stone-600">
						Strona {safePage} / {totalPages}
					</span>
					{safePage < totalPages ? (
						<Link
							className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 transition hover:border-teal-700 hover:text-teal-800"
							href={href(safePage + 1)}
						>
							Następna
						</Link>
					) : (
						<span className="rounded-md border border-stone-200 px-3 py-1.5 text-sm text-stone-300">
							Następna
						</span>
					)}
				</div>
			</div>
		</div>
	);
}
