import { describe, expect, it } from "vitest";

import { isValidPesel, normalizePesel } from "~/lib/pesel";

describe("isValidPesel", () => {
	it("akceptuje dokładnie 11 cyfr", () => {
		expect(isValidPesel("90000000001")).toBe(true);
		expect(isValidPesel("00000000000")).toBe(true);
	});

	it("odrzuca niepoprawną długość", () => {
		expect(isValidPesel("9000000000")).toBe(false);
		expect(isValidPesel("900000000012")).toBe(false);
		expect(isValidPesel("")).toBe(false);
	});

	it("odrzuca znaki inne niż cyfry", () => {
		expect(isValidPesel("9000000000a")).toBe(false);
		expect(isValidPesel("900 0000 0001")).toBe(false);
		expect(isValidPesel("-9000000001")).toBe(false);
	});
});

describe("normalizePesel", () => {
	it("usuwa białe znaki", () => {
		expect(normalizePesel(" 900 000\t00001\n")).toBe("90000000001");
	});

	it("nie zmienia poprawnego numeru", () => {
		expect(normalizePesel("90000000001")).toBe("90000000001");
	});
});
