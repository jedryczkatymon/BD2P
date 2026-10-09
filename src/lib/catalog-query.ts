const PAGE_SIZES = [50, 100, 200] as const;

export type PageSize = (typeof PAGE_SIZES)[number];

export const CATALOG_PAGE_SIZES = PAGE_SIZES;

export type CatalogFilterValues = {
	q?: string;
	authorId?: string;
	publisherId?: string;
	categoryId?: string;
	availableOnly?: boolean;
	pageSize: PageSize;
};

export function parsePageSize(value: string | undefined): PageSize {
	const n = Number(value);
	if (n === 50 || n === 100 || n === 200) return n;
	return 50;
}

export function buildCatalogHref(
	page: number,
	pageSize: number,
	filters: Omit<CatalogFilterValues, "pageSize">,
) {
	const params = new URLSearchParams();
	params.set("page", String(page));
	params.set("pageSize", String(pageSize));
	if (filters.q) params.set("q", filters.q);
	if (filters.authorId) params.set("authorId", filters.authorId);
	if (filters.publisherId) params.set("publisherId", filters.publisherId);
	if (filters.categoryId) params.set("categoryId", filters.categoryId);
	if (filters.availableOnly) params.set("available", "1");
	return `/?${params.toString()}`;
}
