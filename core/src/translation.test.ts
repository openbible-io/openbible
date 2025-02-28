import { expect, test } from "bun:test";
import type { z } from "zod";
import { translation } from "./translation";

// biome-ignore lint/suspicious/noExplicitAny: runtime check
function testRoundtrip(parser: z.ZodTypeAny, input: any) {
	const parsed = parser.parse(input);
	expect(parsed).toEqual(input);
}

test("translation source roundtrips", () => {
	testRoundtrip(translation, [
		{ book: "gen" },
		{ chapter: 1 },
		{ p: "minor" },
		{ v: "1" },
		{ text: "בְּרֵאשִׁ֖ית", lemma: "H7225", parsing: "Prep-b | N-fs" },
		" ",
		{ text: "־פְּנֵ֣י", lemma: "H5921" },
		{ text: "עַל", lemma: "H6440" },
	]);
});

test("translation roundtrips", () => {
	testRoundtrip(translation, [
		{ book: "gen" },
		{ chapter: 1 },
		{ h3: "The First Day" },
		{ p: "" },
		{ v: "1" },
		{ text: "In the beginning", ref: 4 },
		" ",
		{ text: "was over the surface", ref: { from: 6, to: 7 } },
	]);
});
