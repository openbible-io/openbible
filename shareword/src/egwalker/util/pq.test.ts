import { test, expect } from "bun:test";
import PriorityQueue from "./pq";

const nComp = (a: number, b: number) => a - b;

test("push and pop", () => {
	const pq = new PriorityQueue(nComp);

	pq.push(10);
	pq.push(10);
	pq.push(20);
	pq.push(30);
	expect(pq.length).toBe(4);

	expect(pq.pop()).toBe(10);
	expect(pq.pop()).toBe(10);
	expect(pq.pop()).toBe(20);
	expect(pq.pop()).toBe(30);
	expect(pq.length).toBe(0);
});

test("siftUp with odd indices", () => {
	const pq = new PriorityQueue(nComp);

	const items = [15, 7, 21, 14, 13, 22, 12, 6, 7, 25, 5, 24, 11, 16, 15, 24, 2, 1];
	for (const i of items) pq.push(i);

	const sorted = items.sort((a, b) => a - b);
	sorted.forEach(n => expect(pq.pop()).toBe(n));
});
