import { BookCard } from "~/components/book-card";
import { CatalogFilters } from "~/components/catalog-filters";
import {
	CatalogPagination,
	parsePageSize,
} from "~/components/catalog-pagination";
import { api, HydrateClient } from "~/trpc/server";

type HomeProps = {
	searchParams: Promise<{
		page?: string;
		pageSize?: string;
		q?: string;
		authorId?: string;
		publisherId?: string;
		categoryId?: string;
		available?: string;
	}>;
};

function optionalParam(value: string | undefined) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

export default async function Home({ searchParams }: HomeProps) {
	const params = await searchParams;
	const pageSize = parsePageSize(params.pageSize);
	const page = Math.max(1, Number(params.page) || 1);
	const q = optionalParam(params.q);
	const authorId = optionalParam(params.authorId);
	const publisherId = optionalParam(params.publisherId);
	const categoryId = optionalParam(params.categoryId);
	const availableOnly = params.available === "1";

	const filters = {
		q,
		authorId,
		publisherId,
		categoryId,
		availableOnly,
	};

	const [data, filterOptions] = await Promise.all([
		api.book.list({
			page,
			pageSize,
			...filters,
		}),
		api.book.filterOptions(),
	]);

	return (
		<HydrateClient>
			<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
				<div className="mb-6">
					<h1 className="font-semibold text-2xl text-stone-900 tracking-tight sm:text-3xl">
						Katalog książek
					</h1>
					<p className="mt-1 text-stone-600">
						Przeglądaj wydania dostępne w bibliotece.
					</p>
				</div>

				<div className="mb-6">
					<CatalogFilters
						authors={filterOptions.authors}
						categories={filterOptions.categories}
						key={[
							q ?? "",
							authorId ?? "",
							publisherId ?? "",
							categoryId ?? "",
							availableOnly ? "1" : "0",
							String(pageSize),
						].join("|")}
						publishers={filterOptions.publishers}
						values={{ ...filters, pageSize }}
					/>
				</div>

				<div className="mb-6">
					<CatalogPagination
						filters={filters}
						page={data.page}
						pageSize={data.pageSize}
						total={data.total}
					/>
				</div>

				{data.items.length === 0 ? (
					<p className="py-12 text-center text-stone-500">
						Brak książek do wyświetlenia.
					</p>
				) : (
					<ul className="grid gap-0 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
						{data.items.map((book) => (
							<li className="h-full" key={book.id}>
								<BookCard
									authors={book.authors}
									availableCount={book.availableCount}
									id={book.id}
									publicationYear={book.publicationYear}
									title={book.title}
									totalCopies={book.totalCopies}
								/>
							</li>
						))}
					</ul>
				)}

				{data.items.length > 0 && (
					<div className="mt-8 border-stone-200 border-t pt-6">
						<CatalogPagination
							filters={filters}
							page={data.page}
							pageSize={data.pageSize}
							total={data.total}
						/>
					</div>
				)}
			</main>
		</HydrateClient>
	);
}
