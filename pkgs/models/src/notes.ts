import { z } from "zod";
import { ref } from './translation';

const tags = z.object({}).catchall(
	z.object({
		"background-color": z.string().optional(),
		"text-decoration": z.string().optional(),
	}),
);

const mark = z.object({
	ref,
	tag: z.string(),
	children: z.string().optional(),
});

export const notes = z.object({
	title: z.string().optional(),
	categories: z.array(z.string()).optional(),
	created: z.string(),
	updated: z.string(),
	tags: tags.optional(),
	notes: z.object({}).catchall(z.array(mark)),
});
