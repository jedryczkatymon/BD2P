import Link from "next/link";

type Author = {
	firstName: string;
	lastName: string;
};

type BookCardProps = {
	id: string;
	title: string;
	publicationYear: number;
	authors: Author[];
	availableCount: number;
	totalCopies: number;
};

function formatAuthors(authors: Author[]) {
	if (authors.length === 0) return "Autor nieznany";
	return authors.map((a) => `${a.firstName} ${a.lastName}`).join(", ");
}

export function BookCard({
	id,
	title,
	publicationYear,
	authors,
	availableCount,
	totalCopies,
}: BookCardProps) {
	const available = availableCount > 0;

	return (
		<Link
			className="group flex h-full flex-col gap-2 border-stone-200 border-b py-4 transition hover:border-teal-700 sm:border sm:border-stone-200 sm:bg-white sm:px-4 sm:py-4 sm:hover:border-teal-700"
			href={`/books/${id}`}
		>
			<h2 className="font-medium text-stone-900 leading-snug group-hover:text-teal-800">
				{title}
			</h2>
			<p className="text-sm text-stone-600">{formatAuthors(authors)}</p>
			<div className="mt-auto flex items-center justify-between gap-2 pt-1 text-stone-500 text-xs">
				<span>{publicationYear}</span>
				<span
					className={
						available
							? "font-medium text-teal-800"
							: "font-medium text-amber-800"
					}
				>
					{available
						? `Dostępne: ${availableCount}/${totalCopies}`
						: totalCopies === 0
							? "Brak egzemplarzy"
							: "Niedostępne"}
				</span>
			</div>
		</Link>
	);
}
