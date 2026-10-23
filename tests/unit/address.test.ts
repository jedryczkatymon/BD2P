import { describe, expect, it } from "vitest";

import {
	formatAddressLines,
	formatPolishPostalCodeInput,
	isValidPolishPostalCode,
	normalizePostalCode,
} from "~/lib/address";

describe("normalizePostalCode", () => {
	it("wstawia myślnik w pięć cyfr", () => {
		expect(normalizePostalCode("00950")).toBe("00-950");
	});

	it("usuwa białe znaki", () => {
		expect(normalizePostalCode(" 00-950 ")).toBe("00-950");
		expect(normalizePostalCode("00 950")).toBe("00-950");
	});

	it("zostawia kody zagraniczne bez zmian poza spacjami", () => {
		expect(normalizePostalCode("SW1A1AA")).toBe("SW1A1AA");
	});
});

describe("isValidPolishPostalCode", () => {
	it("akceptuje format NN-NNN", () => {
		expect(isValidPolishPostalCode("00-950")).toBe(true);
	});

	it("odrzuca inne formaty", () => {
		expect(isValidPolishPostalCode("00950")).toBe(false);
		expect(isValidPolishPostalCode("0-0950")).toBe(false);
		expect(isValidPolishPostalCode("00-95")).toBe(false);
		expect(isValidPolishPostalCode("ab-cde")).toBe(false);
	});
});

describe("formatPolishPostalCodeInput", () => {
	it("wstawia myślnik po dwóch cyfrach w trakcie pisania", () => {
		expect(formatPolishPostalCodeInput("0")).toBe("0");
		expect(formatPolishPostalCodeInput("00")).toBe("00");
		expect(formatPolishPostalCodeInput("009")).toBe("00-9");
		expect(formatPolishPostalCodeInput("00950")).toBe("00-950");
	});

	it("pomija znaki inne niż cyfry i obcina do pięciu cyfr", () => {
		expect(formatPolishPostalCodeInput("00-9a50")).toBe("00-950");
		expect(formatPolishPostalCodeInput("0095012")).toBe("00-950");
	});
});

describe("formatAddressLines", () => {
	it("zwraca dwie linie pełnego adresu", () => {
		expect(
			formatAddressLines({
				street: "ul. Długa 5/12",
				postalCode: "00-950",
				city: "Warszawa",
			}),
		).toEqual(["ul. Długa 5/12", "00-950 Warszawa"]);
	});

	it("pomija brakujące części", () => {
		expect(
			formatAddressLines({ street: null, postalCode: null, city: "Londyn" }),
		).toEqual(["Londyn"]);
		expect(
			formatAddressLines({ street: null, postalCode: null, city: null }),
		).toEqual([]);
	});
});
