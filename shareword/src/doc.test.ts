import { test, expect } from "bun:test";
import { Doc } from "./doc";

test("basic merge", () => {
	const doc1 = new Doc("user1");
	doc1.insert("share");

	const doc2 = new Doc("user2");
	doc2.insert("word");

	doc1.merge(doc2);
	doc2.merge(doc1);

	const expected = "shareword";

	expect(doc1.getContent()).toBe(expected);
	expect(doc2.getContent()).toBe(expected);

	doc1.delete(-5);
	doc1.insert("the");

	doc2.insert("s");

	doc1.merge(doc2);
	doc2.merge(doc1);

	const expected2 = "thewords";

	expect(doc1.getContent()).toBe(expected2);
	expect(doc2.getContent()).toBe(expected2);
});
