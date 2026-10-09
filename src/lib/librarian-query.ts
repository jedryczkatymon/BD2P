import {
	CATALOG_PAGE_SIZES,
	type PageSize,
	parsePageSize,
} from "~/lib/catalog-query";

export type { PageSize };
export { CATALOG_PAGE_SIZES, parsePageSize };

export type LibrarianTab = "active" | "archive" | "catalog" | "users";

export function parseLibrarianTab(value: string | undefined): LibrarianTab {
	if (value === "history" || value === "archive") return "archive";
	if (value === "catalog" || value === "active" || value === "users") {
		return value;
	}
	return "active";
}

export type LibrarianListFilters = {
	q?: string;
	pageSize: PageSize;
	status?: "FULFILLED" | "CANCELLED";
	section?: "loans" | "reservations";
	overdue?: boolean;
	/** Preserve the other section's page when paginating archive. */
	page?: number;
	loanPage?: number;
};

export type LibrarianPageParam = "page" | "loanPage";

export function buildLibrarianHref(
	tab: LibrarianTab,
	page: number,
	filters: LibrarianListFilters,
	pageParam: LibrarianPageParam = "page",
) {
	const params = new URLSearchParams();
	params.set("tab", tab);
	params.set("pageSize", String(filters.pageSize));

	if (pageParam === "loanPage") {
		params.set("loanPage", String(page));
		const reservationPage = filters.page ?? 1;
		if (reservationPage > 1) params.set("page", String(reservationPage));
	} else {
		params.set("page", String(page));
		if (filters.loanPage && filters.loanPage > 1) {
			params.set("loanPage", String(filters.loanPage));
		}
	}

	if (filters.q) params.set("q", filters.q);
	if (filters.status) params.set("status", filters.status);
	if (filters.section) params.set("section", filters.section);
	if (filters.overdue) params.set("overdue", "1");
	return `/librarian?${params.toString()}`;
}
