import { bookIds } from "./books";
import { z } from "zod";

const book = z.object({
	b: z.enum(bookIds),
});

const chapter = z.object({
	c: z.number().int().nonnegative(),
});

const p = z.object({
	p: z.enum(["", "major", "minor", "tab1", "tab2"]),
});

const v = z.object({
	v: z.string(),
});

export const ref = z.union([
	z.number().int().nonnegative(),
	z.object({
		from: z.number().int().nonnegative(),
		fromOffset: z.number().int().positive().optional(),
		to: z.number().int().nonnegative(),
		toOffset: z.number().int().positive().optional(),
	}),
]);
export type Ref = z.infer<typeof ref>;

const lemma = z.string();
const parsing = z.string();

const text = z.union([z.string(), z.object({
	text: z.string(),
	lemma: lemma.optional(),
	parsing: parsing.optional(),
	ref: ref.optional(),
	class: z.string().optional(),
})]);
export type Text = z.infer<typeof text>;

const br = z.object({ br: z.enum([""]) });

const h1 = z.object({ h1: z.string() });
const h2 = z.object({ h2: z.string() });
const h3 = z.object({ h3: z.string() });
const h4 = z.object({ h4: z.string() });
const h5 = z.object({ h5: z.string() });
const h6 = z.object({ h6: z.string() });

const heading = z.union([h1, h2, h3, h4, h5, h6]);

export const element = z.union([book, chapter, p, v, text, br, heading]);
export type Element = z.infer<typeof translation>;
export const translation = z.array(element);
export type Translation = z.infer<typeof translation>;
