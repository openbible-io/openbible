import { expect, test } from "bun:test";
import { bookDetails, bookFromEnglish } from "./books";

test("tricky books", () => {
	expect(bookFromEnglish("1 Samuel")).toBe("1sa");
	expect(bookFromEnglish("Esther")).toBe("est");
});
test("maps back to self", () => {
	for (const p of Object.keys(bookDetails)) {
		expect(bookFromEnglish(p) as string).toBe(p);
	}
});
