import { redirect } from "next/navigation";

import { LoginForm } from "~/components/login-form";
import { getSession } from "~/server/better-auth/server";

export default async function LoginPage() {
	const session = await getSession();
	if (session?.user) {
		redirect("/account");
	}

	return (
		<main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
			<div className="mb-8 text-center">
				<h1 className="font-semibold text-2xl text-stone-900 tracking-tight">
					Logowanie
				</h1>
				<p className="mt-1 text-stone-600">
					Zaloguj się, aby zobaczyć dane konta.
				</p>
			</div>
			<LoginForm />
		</main>
	);
}
