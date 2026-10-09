import { redirect } from "next/navigation";

import { RegisterForm } from "~/components/register-form";
import { getSession } from "~/server/better-auth/server";

export default async function RegisterPage() {
	const session = await getSession();
	if (session?.user) {
		redirect("/account");
	}

	return (
		<main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
			<div className="mb-8 text-center">
				<h1 className="font-semibold text-2xl text-stone-900 tracking-tight">
					Rejestracja
				</h1>
				<p className="mt-1 text-stone-600">
					Utwórz konto czytelnika w bibliotece.
				</p>
			</div>
			<RegisterForm />
		</main>
	);
}
