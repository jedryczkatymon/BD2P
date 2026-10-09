import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "~/server/better-auth";
import { getSession } from "~/server/better-auth/server";

export async function Header() {
	const session = await getSession();

	return (
		<header className="border-stone-200 border-b bg-white/90 backdrop-blur">
			<div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
				<Link
					className="font-semibold text-stone-900 tracking-tight hover:text-teal-800"
					href="/"
				>
					Biblioteka miejska
				</Link>
				<nav className="flex items-center gap-3 text-sm">
					{session?.user ? (
						<>
							{(session.user as { role?: string }).role === "LIBRARIAN" ? (
								<Link
									className="text-stone-600 transition hover:text-teal-800"
									href="/librarian"
								>
									Panel
								</Link>
							) : null}
							<Link
								className="text-stone-600 transition hover:text-teal-800"
								href="/account"
							>
								Konto
							</Link>
							<span className="hidden text-stone-400 sm:inline">
								{[session.user.firstName, session.user.lastName]
									.filter(Boolean)
									.join(" ") || session.user.name}
							</span>
							<form>
								<button
									className="rounded-md bg-stone-900 px-3 py-1.5 font-medium text-white transition hover:bg-teal-800"
									formAction={async () => {
										"use server";
										await auth.api.signOut({
											headers: await headers(),
										});
										redirect("/");
									}}
									type="submit"
								>
									Wyloguj
								</button>
							</form>
						</>
					) : (
						<>
							<Link
								className="text-stone-600 transition hover:text-teal-800"
								href="/login"
							>
								Zaloguj
							</Link>
							<Link
								className="rounded-md bg-stone-900 px-3 py-1.5 font-medium text-white transition hover:bg-teal-800"
								href="/register"
							>
								Zarejestruj
							</Link>
						</>
					)}
				</nav>
			</div>
		</header>
	);
}
