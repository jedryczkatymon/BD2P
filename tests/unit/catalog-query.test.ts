import { describe, expect, it } from "vitest";

import { buildCatalogHref, parsePageSize } from "~/lib/catalog-query";

describe("parsePageSize", () => {
	it("akceptuje dozwolone rozmiary strony", () => {
		expect(parsePageSize("50")).toBe(50);
		expect(parsePageSize("100")).toBe(100);
		expect(parsePageSize("200")).toBe(200);
	});

	it("zwraca 50 dla nieznanych lub brakujących wartości", () => {
		expect(parsePageSize(undefined)).toBe(50);
		expect(parsePageSize("")).toBe(50);
		expect(parsePageSize("25")).toBe(50);
		expect(parsePageSize("abc")).toBe(50);
	});
});

describe("buildCatalogHref", () => {
	it("zawiera tylko stronę i rozmiar bez filtrów", () => {
		expect(buildCatalogHref(2, 100, {})).toBe("/?page=2&pageSize=100");
	});

	it("dodaje ustawione filtry", () => {
		const href = buildCatalogHref(1, 50, {
			q: "lalka prus",
			authorId: "a1",
			publisherId: "p1",
			categoryId: "c1",
			availableOnly: true,
		});
		const params = new URL(href, "http://localhost").searchParams;

		expect(href.startsWith("/?")).toBe(true);
		expect(params.get("q")).toBe("lalka prus");
		expect(params.get("authorId")).toBe("a1");
		expect(params.get("publisherId")).toBe("p1");
		expect(params.get("categoryId")).toBe("c1");
		expect(params.get("available")).toBe("1");
	});

	it("pomija puste filtry i availableOnly=false", () => {
		const href = buildCatalogHref(1, 50, {
			q: "",
			authorId: undefined,
			availableOnly: false,
		});
		expect(href).toBe("/?page=1&pageSize=50");
	});
});
