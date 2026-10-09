"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "~/trpc/react";

type ProfileFormProps = {
	user: {
		email: string;
		firstName: string;
		lastName: string;
		phone: string | null;
		pesel: string;
		role: string;
	};
};

function roleLabel(role: string) {
	if (role === "LIBRARIAN") return "Bibliotekarz";
	if (role === "MEMBER") return "Czytelnik";
	return role;
}

const fieldClassName = "flex flex-col gap-1";
const labelClassName = "font-medium text-sm text-stone-700";
const inputClassName =
	"w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 outline-none focus:border-teal-700";
const readonlyValueClassName =
	"flex min-h-[2.625rem] items-center px-3 py-2 text-stone-900";

export function ProfileForm({ user }: ProfileFormProps) {
	const router = useRouter();
	const [firstName, setFirstName] = useState(user.firstName);
	const [lastName, setLastName] = useState(user.lastName);
	const [phone, setPhone] = useState(user.phone ?? "");
	const [success, setSuccess] = useState(false);

	const updateProfile = api.user.updateProfile.useMutation({
		onSuccess: () => {
			setSuccess(true);
			router.refresh();
		},
		onError: () => {
			setSuccess(false);
		},
	});

	function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSuccess(false);
		updateProfile.mutate({
			firstName,
			lastName,
			phone,
		});
	}

	return (
		<form className="mt-4 space-y-4" onSubmit={onSubmit}>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className={fieldClassName}>
					<label className={labelClassName} htmlFor="profile-firstName">
						Imię
					</label>
					<input
						className={inputClassName}
						id="profile-firstName"
						onChange={(e) => setFirstName(e.target.value)}
						required
						type="text"
						value={firstName}
					/>
				</div>

				<div className={fieldClassName}>
					<label className={labelClassName} htmlFor="profile-lastName">
						Nazwisko
					</label>
					<input
						className={inputClassName}
						id="profile-lastName"
						onChange={(e) => setLastName(e.target.value)}
						required
						type="text"
						value={lastName}
					/>
				</div>

				<div className={fieldClassName}>
					<label className={labelClassName} htmlFor="profile-phone">
						Telefon
					</label>
					<input
						className={inputClassName}
						id="profile-phone"
						onChange={(e) => setPhone(e.target.value)}
						type="tel"
						value={phone}
					/>
				</div>

				<div className={fieldClassName}>
					<p className={labelClassName}>PESEL</p>
					<p className={readonlyValueClassName}>{user.pesel}</p>
				</div>

				<div className={fieldClassName}>
					<p className={labelClassName}>E-mail</p>
					<p className={readonlyValueClassName}>{user.email}</p>
				</div>

				<div className={fieldClassName}>
					<p className={labelClassName}>Rola</p>
					<p className={readonlyValueClassName}>{roleLabel(user.role)}</p>
				</div>
			</div>

			{updateProfile.error && (
				<p className="text-red-700 text-sm" role="alert">
					{updateProfile.error.message}
				</p>
			)}
			{success && !updateProfile.error && (
				<p className="text-sm text-teal-800" role="status">
					Zapisano zmiany.
				</p>
			)}

			<button
				className="rounded-md bg-stone-900 px-4 py-2.5 font-medium text-sm text-white transition hover:bg-teal-800 disabled:opacity-60"
				disabled={updateProfile.isPending}
				type="submit"
			>
				{updateProfile.isPending ? "Zapisywanie…" : "Zapisz profil"}
			</button>
		</form>
	);
}
