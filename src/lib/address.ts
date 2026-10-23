const POLISH_POSTAL_CODE_REGEX = /^\d{2}-\d{3}$/;

export type Address = {
	street: string | null;
	postalCode: string | null;
	city: string | null;
};

/** Usuwa białe znaki; pięć cyfr bez myślnika zamienia na format NN-NNN. */
export function normalizePostalCode(value: string): string {
	const compact = value.replace(/\s+/g, "");
	return /^\d{5}$/.test(compact)
		? `${compact.slice(0, 2)}-${compact.slice(2)}`
		: compact;
}

/** Polski kod pocztowy: NN-NNN. */
export function isValidPolishPostalCode(value: string): boolean {
	return POLISH_POSTAL_CODE_REGEX.test(value);
}

/**
 * Formatuje kod pocztowy w trakcie pisania: zostawia tylko cyfry
 * (najwyżej pięć) i wstawia myślnik po drugiej.
 */
export function formatPolishPostalCodeInput(value: string): string {
	const digits = value.replace(/\D/g, "").slice(0, 5);
	return digits.length > 2
		? `${digits.slice(0, 2)}-${digits.slice(2)}`
		: digits;
}

/** Adres do wyświetlenia w dwóch liniach: „ulica i numer”, „kod miasto”. */
export function formatAddressLines(address: Address): string[] {
	const locality = [address.postalCode, address.city].filter(Boolean).join(" ");
	return [address.street, locality].filter((line): line is string =>
		Boolean(line),
	);
}
