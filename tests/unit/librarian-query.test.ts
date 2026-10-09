import { describe, expect, it } from "vitest";

import { buildLibrarianHref, parseLibrarianTab } from "~/lib/librarian-query";

function paramsOf(href: string) {
	return new URL(href, "http://localhost").searchParams;
}

describe("parseLibrarianTab", () => {
	it("zwraca znane zakładki", () => {
		expect(parseLibrarianTab("active")).toBe("active");
		expect(parseLibrarianTab("archive")).toBe("archive");
		expect(parseLibrarianTab("catalog")).toBe("catalog");
		expect(parseLibrarianTab("users")).toBe("users");
	});

	it("mapuje alias history na archive", () => {
		expect(parseLibrarianTab("history")).toBe("archive");
	});

	it("domyślnie zwraca active", () => {
		expect(parseLibrarianTab(undefined)).toBe("active");
		expect(parseLibrarianTab("coś-innego")).toBe("active");
	});
});

describe("buildLibrarianHref", () => {
	it("buduje podstawowy adres z zakładką, stroną i rozmiarem", () => {
		const href = buildLibrarianHref("users", 3, { pageSize: 100 });
		expect(href.startsWith("/librarian?")).toBe(true);

		const params = paramsOf(href);
		expect(params.get("tab")).toBe("users");
		expect(params.get("page")).toBe("3");
		expect(params.get("pageSize")).toBe("100");
		expect(params.has("q")).toBe(false);
	});

	it("dodaje filtry", () => {
		const params = paramsOf(
			buildLibrarianHref("archive", 1, {
				pageSize: 50,
				q: "nowak",
				status: "CANCELLED",
				section: "reservations",
				overdue: true,
			}),
		);
		expect(params.get("q")).toBe("nowak");
		expect(params.get("status")).toBe("CANCELLED");
		expect(params.get("section")).toBe("reservations");
		expect(params.get("overdue")).toBe("1");
	});

	it("zachowuje loanPage > 1 przy paginacji rezerwacji", () => {
		const params = paramsOf(
			buildLibrarianHref("archive", 2, { pageSize: 50, loanPage: 4 }),
		);
		expect(params.get("page")).toBe("2");
		expect(params.get("loanPage")).toBe("4");
	});

	it("pomija loanPage równe 1", () => {
		const params = paramsOf(
			buildLibrarianHref("archive", 2, { pageSize: 50, loanPage: 1 }),
		);
		expect(params.has("loanPage")).toBe(false);
	});

	it("przy paginacji wypożyczeń ustawia loanPage i zachowuje page > 1", () => {
		const params = paramsOf(
			buildLibrarianHref("archive", 5, { pageSize: 50, page: 3 }, "loanPage"),
		);
		expect(params.get("loanPage")).toBe("5");
		expect(params.get("page")).toBe("3");
	});

	it("przy paginacji wypożyczeń pomija page równe 1", () => {
		const params = paramsOf(
			buildLibrarianHref("archive", 2, { pageSize: 50 }, "loanPage"),
		);
		expect(params.get("loanPage")).toBe("2");
		expect(params.has("page")).toBe(false);
	});
});
