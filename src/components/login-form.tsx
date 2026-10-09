"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "~/server/better-auth/client";

export function LoginForm() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setPending(true);

		const result = await authClient.signIn.email({
			email,
			password,
		});

		setPending(false);

		if (result.error) {
			setError(result.error.message ?? "Nie udało się zalogować");
			return;
		}

		router.push("/account");
		router.refresh();
	}

	return (
		<form className="mx-auto w-full max-w-md space-y-4" onSubmit={onSubmit}>
			<div>
				<label
					className="mb-1 block font-medium text-sm text-stone-700"
					htmlFor="email"
				>
					E-mail
				</label>
				<input
					autoComplete="email"
					className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-700"
					id="email"
					onChange={(e) => setEmail(e.target.value)}
					required
					type="email"
					value={email}
				/>
			</div>
			<div>
				<label
					className="mb-1 block font-medium text-sm text-stone-700"
					htmlFor="password"
				>
					Hasło
				</label>
				<input
					autoComplete="current-password"
					className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-700"
					id="password"
					onChange={(e) => setPassword(e.target.value)}
					required
					type="password"
					value={password}
				/>
			</div>

			{error && (
				<p className="text-red-700 text-sm" role="alert">
					{error}
				</p>
			)}

			<button
				className="w-full rounded-md bg-stone-900 px-4 py-2.5 font-medium text-white transition hover:bg-teal-800 disabled:opacity-60"
				disabled={pending}
				type="submit"
			>
				{pending ? "Logowanie…" : "Zaloguj się"}
			</button>

			<p className="text-center text-sm text-stone-600">
				Nie masz konta?{" "}
				<Link className="text-teal-800 hover:underline" href="/register">
					Zarejestruj się
				</Link>
			</p>
		</form>
	);
}
