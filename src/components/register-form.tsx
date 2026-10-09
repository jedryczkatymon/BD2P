"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { isValidPesel, normalizePesel } from "~/lib/pesel";
import { authClient } from "~/server/better-auth/client";

export function RegisterForm() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [phone, setPhone] = useState("");
	const [pesel, setPesel] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setPending(true);

		const trimmedFirst = firstName.trim();
		const trimmedLast = lastName.trim();
		const normalizedPesel = normalizePesel(pesel);

		if (!isValidPesel(normalizedPesel)) {
			setPending(false);
			setError("PESEL musi składać się z 11 cyfr");
			return;
		}

		const result = await authClient.signUp.email({
			name: `${trimmedFirst} ${trimmedLast}`.trim(),
			email,
			password,
			firstName: trimmedFirst,
			lastName: trimmedLast,
			phone: phone.trim() || undefined,
			pesel: normalizedPesel,
		});

		setPending(false);

		if (result.error) {
			setError(result.error.message ?? "Nie udało się zarejestrować");
			return;
		}

		router.push("/account");
		router.refresh();
	}

	return (
		<form className="mx-auto w-full max-w-md space-y-4" onSubmit={onSubmit}>
			<div className="grid gap-4 sm:grid-cols-2">
				<div>
					<label
						className="mb-1 block font-medium text-sm text-stone-700"
						htmlFor="firstName"
					>
						Imię
					</label>
					<input
						autoComplete="given-name"
						className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-700"
						id="firstName"
						onChange={(e) => setFirstName(e.target.value)}
						required
						type="text"
						value={firstName}
					/>
				</div>
				<div>
					<label
						className="mb-1 block font-medium text-sm text-stone-700"
						htmlFor="lastName"
					>
						Nazwisko
					</label>
					<input
						autoComplete="family-name"
						className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-700"
						id="lastName"
						onChange={(e) => setLastName(e.target.value)}
						required
						type="text"
						value={lastName}
					/>
				</div>
			</div>
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
					htmlFor="phone"
				>
					Telefon
				</label>
				<input
					autoComplete="tel"
					className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-700"
					id="phone"
					onChange={(e) => setPhone(e.target.value)}
					type="tel"
					value={phone}
				/>
			</div>
			<div>
				<label
					className="mb-1 block font-medium text-sm text-stone-700"
					htmlFor="pesel"
				>
					PESEL
				</label>
				<input
					autoComplete="off"
					className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-700"
					id="pesel"
					inputMode="numeric"
					maxLength={11}
					minLength={11}
					onChange={(e) => setPesel(e.target.value)}
					pattern="\d{11}"
					required
					title="PESEL składa się z 11 cyfr"
					type="text"
					value={pesel}
				/>
				<p className="mt-1 text-stone-500 text-xs">
					Nie można go zmienić po rejestracji.
				</p>
			</div>
			<div>
				<label
					className="mb-1 block font-medium text-sm text-stone-700"
					htmlFor="password"
				>
					Hasło
				</label>
				<input
					autoComplete="new-password"
					className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-700"
					id="password"
					minLength={8}
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
				{pending ? "Rejestracja…" : "Utwórz konto"}
			</button>

			<p className="text-center text-sm text-stone-600">
				Masz już konto?{" "}
				<Link className="text-teal-800 hover:underline" href="/login">
					Zaloguj się
				</Link>
			</p>
		</form>
	);
}
