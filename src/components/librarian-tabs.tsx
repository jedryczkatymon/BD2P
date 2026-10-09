import Link from "next/link";

import type { LibrarianTab } from "~/lib/librarian-query";

const TABS: { id: LibrarianTab; label: string }[] = [
	{ id: "active", label: "Aktywne" },
	{ id: "archive", label: "Archiwum" },
	{ id: "catalog", label: "Księgozbiór" },
	{ id: "users", label: "Użytkownicy" },
];

type LibrarianTabsProps = {
	active: LibrarianTab;
};

export function LibrarianTabs({ active }: LibrarianTabsProps) {
	return (
		<nav className="flex flex-wrap gap-1 border-stone-200 border-b">
			{TABS.map((tab) => {
				const isActive = tab.id === active;
				return (
					<Link
						className={
							isActive
								? "-mb-px border-teal-800 border-b-2 px-3 py-2 font-medium text-sm text-teal-900"
								: "px-3 py-2 text-sm text-stone-600 transition hover:text-teal-800"
						}
						href={`/librarian?tab=${tab.id}`}
						key={tab.id}
					>
						{tab.label}
					</Link>
				);
			})}
		</nav>
	);
}
