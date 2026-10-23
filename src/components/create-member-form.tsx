"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
	AddressFields,
	type AddressFormValue,
	emptyAddress,
} from "~/components/address-fields";
import { isValidPesel, normalizePesel } from "~/lib/pesel";
import { api } from "~/trpc/react";

const inputClassName =
	"h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none focus:border-teal-700";
const labelClassName = "mb-1 block font-medium text-sm text-stone-700";

export function CreateMemberForm() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [phone, setPhone] = useState("");
	const [pesel, setPesel] = useState("");
	const [address, setAddress] = useState<AddressFormValue>(emptyAddress);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const create = api.librarian.createMember.useMutation({
		onSuccess: (_data, variables) => {
			setError(null);
			setMessage(
				`Utworzono konto czytelnika ${variables.firstName} ${variables.lastName} (${variables.email}).`,
			);
			setEmail("");
			setPassword("");
			setFirstName("");
			setLastName("");
			setPhone("");
			setPesel("");
			setAddress(emptyAddress());
			router.refresh();
		},
		onError: (err) => {
			setMessage(null);
			setError(err.message);
		},
	});

	function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setMessage(null);

		const normalizedPesel = normalizePesel(pesel);
		if (!isValidPesel(normalizedPesel)) {
			setError("PESEL musi składać się z 11 cyfr");
			return;
		}

		create.mutate({
			firstName: firstName.trim(),
			lastName: lastName.trim(),
			email: email.trim(),
			phone: phone.trim() || undefined,
			pesel: normalizedPesel,
			street: address.street.trim(),
			postalCode: address.postalCode,
			city: address.city.trim(),
			password,
		});
	}

	return (
		<form className="mt-3 space-y-4" onSubmit={onSubmit}>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<div>
					<label className={labelClassName} htmlFor="member-firstName">
						Imię
					</label>
					<input
						autoComplete="off"
						className={inputClassName}
						id="member-firstName"
						onChange={(e) => setFirstName(e.target.value)}
						required
						type="text"
						value={firstName}
					/>
				</div>
				<div>
					<label className={labelClassName} htmlFor="member-lastName">
						Nazwisko
					</label>
					<input
						autoComplete="off"
						className={inputClassName}
						id="member-lastName"
						onChange={(e) => setLastName(e.target.value)}
						required
						type="text"
						value={lastName}
					/>
				</div>
				<div>
					<label className={labelClassName} htmlFor="member-email">
						E-mail
					</label>
					<input
						autoComplete="off"
						className={inputClassName}
						id="member-email"
						onChange={(e) => setEmail(e.target.value)}
						required
						type="email"
						value={email}
					/>
				</div>
				<div>
					<label className={labelClassName} htmlFor="member-phone">
						Telefon
					</label>
					<input
						autoComplete="off"
						className={inputClassName}
						id="member-phone"
						onChange={(e) => setPhone(e.target.value)}
						type="tel"
						value={phone}
					/>
				</div>
				<div>
					<label className={labelClassName} htmlFor="member-pesel">
						PESEL
					</label>
					<input
						autoComplete="off"
						className={inputClassName}
						id="member-pesel"
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
						Nie można go zmienić po utworzeniu konta.
					</p>
				</div>
				<div>
					<label className={labelClassName} htmlFor="member-password">
						Hasło początkowe
					</label>
					<input
						autoComplete="new-password"
						className={inputClassName}
						id="member-password"
						minLength={8}
						onChange={(e) => setPassword(e.target.value)}
						required
						type="password"
						value={password}
					/>
					<p className="mt-1 text-stone-500 text-xs">
						Co najmniej 8 znaków; przekaż je czytelnikowi.
					</p>
				</div>
			</div>

			<AddressFields
				className="max-w-2xl"
				idPrefix="member"
				inputClassName={inputClassName}
				labelClassName={labelClassName}
				onChange={setAddress}
				postalCodeMode="pl"
				required
				value={address}
			/>

			{error && (
				<p className="text-red-700 text-sm" role="alert">
					{error}
				</p>
			)}
			{message && (
				<p className="text-sm text-teal-800" role="status">
					{message}
				</p>
			)}

			<button
				className="rounded-md bg-stone-900 px-4 py-2 font-medium text-sm text-white transition hover:bg-teal-800 disabled:opacity-60"
				disabled={create.isPending}
				type="submit"
			>
				{create.isPending ? "Tworzenie…" : "Utwórz konto czytelnika"}
			</button>
		</form>
	);
}
