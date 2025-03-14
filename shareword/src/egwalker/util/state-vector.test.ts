import { expect, test } from "bun:test";
import StateVector from './state-vector';

test("diff", () => {
	const a = new StateVector();
	a.clocks.a = 23;
	a.clocks.b = 23;

	const b = new StateVector();
	b.clocks.a = 14;

	expect(a.diff(b)).toEqual({ a: 15, b: 0 });
	expect(b.diff(a)).toEqual({});
});
