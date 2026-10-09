"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "~/trpc/react";

type ReserveButtonProps = {
	bookId: string;
	availableCount: number;
	isLoggedIn: boolean;
	reservationId: string | null;
};

export function ReserveButton({
	bookId,
	availableCount,
	isLoggedIn,
	reservationId,
}: ReserveButtonProps) {
	const router = useRouter();
	const utils = api.useUtils();
	const [error, setError] = useState<string | null>(null);
	const [optimisticId, setOptimisticId] = useState<string | null | undefined>(
		undefined,
	);

	const activeId = optimisticId !== undefined ? optimisticId : reservationId;

	useEffect(() => {
		if (optimisticId === undefined) return;
		if (optimisticId === reservationId) {
			setOptimisticId(undefined);
		}
		if (optimisticId === null && reservationId === null) {
			setOptimisticId(undefined);
		}
	}, [reservationId, optimisticId]);

	const reserve = api.book.reserve.useMutation({
		onMutate: () => {
			setError(null);
			setOptimisticId("optimistic");
		},
		onSuccess: (data) => {
			setOptimisticId(data.id);
			void utils.book.myReservation.invalidate({ bookId });
			void router.refresh();
		},
		onError: (err) => {
			setOptimisticId(reservationId);
			setError(err.message);
		},
	});

	const cancel = api.book.cancelReservation.useMutation({
		onMutate: () => {
			setError(null);
			setOptimisticId(null);
		},
		onSuccess: () => {
			setOptimisticId(null);
			void utils.book.myReservation.invalidate({ bookId });
			void router.refresh();
		},
		onError: (err) => {
			setOptimisticId(reservationId);
			setError(err.message);
		},
	});

	const pending = reserve.isPending || cancel.isPending;

	if (!isLoggedIn) {
		return (
			<div className="mt-6">
				<Link
					className="inline-flex rounded-md bg-stone-900 px-4 py-2.5 font-medium text-sm text-white transition hover:bg-teal-800"
					href="/login"
				>
					Zaloguj się, aby zarezerwować
				</Link>
			</div>
		);
	}

	if (activeId) {
		return (
			<div className="mt-6 space-y-2">
				<button
					className="rounded-md border border-teal-700 bg-white px-4 py-2.5 font-medium text-sm text-teal-800 transition hover:bg-teal-50 disabled:opacity-60"
					disabled={pending}
					onClick={() => cancel.mutate({ bookId })}
					type="button"
				>
					Zwolnij
				</button>
				{error && (
					<p className="text-red-700 text-sm" role="alert">
						{error}
					</p>
				)}
			</div>
		);
	}

	if (availableCount > 0) {
		return (
			<p className="mt-6 text-sm text-stone-600">
				Rezerwacja możliwa tylko, gdy brak dostępnych egzemplarzy.
			</p>
		);
	}

	return (
		<div className="mt-6 space-y-2">
			<button
				className="rounded-md bg-stone-900 px-4 py-2.5 font-medium text-sm text-white transition hover:bg-teal-800 disabled:opacity-60"
				disabled={pending}
				onClick={() => reserve.mutate({ bookId })}
				type="button"
			>
				Zarezerwuj
			</button>
			{error && (
				<p className="text-red-700 text-sm" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
