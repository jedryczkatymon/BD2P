const PESEL_REGEX = /^\d{11}$/;

/** Usuwa białe znaki z numeru PESEL. */
export function normalizePesel(value: string): string {
	return value.replace(/\s+/g, "");
}

/** PESEL musi składać się dokładnie z 11 cyfr. */
export function isValidPesel(value: string): boolean {
	return PESEL_REGEX.test(value);
}
