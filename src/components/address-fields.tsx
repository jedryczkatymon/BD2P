"use client";

import { formatPolishPostalCodeInput } from "~/lib/address";

export type AddressFormValue = {
	street: string;
	postalCode: string;
	city: string;
};

export const emptyAddress = (): AddressFormValue => ({
	street: "",
	postalCode: "",
	city: "",
});

type AddressFieldsProps = {
	/** Prefix for input ids, unique per form. */
	idPrefix: string;
	value: AddressFormValue;
	onChange: (value: AddressFormValue) => void;
	required?: boolean;
	/** "pl" formats and validates NN-NNN; "any" accepts foreign formats. */
	postalCodeMode: "pl" | "any";
	inputClassName: string;
	labelClassName: string;
	className?: string;
};

/**
 * Address as a separate group, laid out like a Polish address:
 * street and number on one line, postal code next to the city below.
 */
export function AddressFields({
	idPrefix,
	value,
	onChange,
	required = false,
	postalCodeMode,
	inputClassName,
	labelClassName,
	className,
}: AddressFieldsProps) {
	const isPl = postalCodeMode === "pl";
	const optionalPlaceholder = required ? undefined : "opcjonalnie";
	// A street or postal code without a city is not an address.
	const cityRequired =
		required || Boolean(value.street.trim() || value.postalCode.trim());

	return (
		<fieldset className={className}>
			<legend className="mb-2 font-medium text-sm text-stone-900">Adres</legend>
			<div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
				<div className="sm:col-span-2">
					<label className={labelClassName} htmlFor={`${idPrefix}-street`}>
						Ulica i numer
					</label>
					<input
						autoComplete="street-address"
						className={inputClassName}
						id={`${idPrefix}-street`}
						maxLength={200}
						onChange={(e) => onChange({ ...value, street: e.target.value })}
						placeholder={required ? "np. ul. Długa 5/12" : optionalPlaceholder}
						required={required}
						type="text"
						value={value.street}
					/>
				</div>
				<div>
					<label className={labelClassName} htmlFor={`${idPrefix}-postalCode`}>
						Kod pocztowy
					</label>
					<input
						autoComplete="postal-code"
						className={inputClassName}
						id={`${idPrefix}-postalCode`}
						inputMode={isPl ? "numeric" : "text"}
						maxLength={isPl ? 6 : 12}
						onChange={(e) =>
							onChange({
								...value,
								postalCode: isPl
									? formatPolishPostalCodeInput(e.target.value)
									: e.target.value,
							})
						}
						pattern={isPl ? "\\d{2}-\\d{3}" : undefined}
						placeholder={isPl ? "00-000" : optionalPlaceholder}
						required={required}
						title={isPl ? "Kod pocztowy w formacie 00-000" : undefined}
						type="text"
						value={value.postalCode}
					/>
				</div>
				<div>
					<label className={labelClassName} htmlFor={`${idPrefix}-city`}>
						Miasto
					</label>
					<input
						autoComplete="address-level2"
						className={inputClassName}
						id={`${idPrefix}-city`}
						maxLength={100}
						onChange={(e) => onChange({ ...value, city: e.target.value })}
						placeholder={cityRequired ? undefined : optionalPlaceholder}
						required={cityRequired}
						type="text"
						value={value.city}
					/>
				</div>
			</div>
		</fieldset>
	);
}
