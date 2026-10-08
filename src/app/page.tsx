import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "~/server/better-auth";
import { getSession } from "~/server/better-auth/server";
import { api, HydrateClient } from "~/trpc/server";

export default async function Home() {
	const hello = await api.post.hello({ text: "from tRPC" });
	const session = await getSession();

	return (
		<HydrateClient>
			<main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
				<div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
					<h1 className="font-extrabold text-5xl tracking-tight sm:text-[5rem]">
						Baza <span className="text-[hsl(280,100%,70%)]">książek</span>
					</h1>
					<p className="max-w-xl text-center text-lg text-white/80">
						System wypożyczeń bibliotecznych — Next.js, tRPC, Prisma,
						PostgreSQL, Better Auth (email + hasło).
					</p>
					<div className="flex flex-col items-center gap-2">
						<p className="text-2xl text-white">
							{hello ? hello.greeting : "Loading tRPC query..."}
						</p>

						<div className="flex flex-col items-center justify-center gap-4">
							<p className="text-center text-2xl text-white">
								{session && <span>Zalogowano jako {session.user?.name}</span>}
							</p>
							{session ? (
								<form>
									<button
										className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
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
							) : (
								<p className="text-center text-white/70">
									Logowanie email + hasło przez Better Auth (
									<code className="text-sm">/api/auth/*</code>).
								</p>
							)}
						</div>
					</div>
				</div>
			</main>
		</HydrateClient>
	);
}
