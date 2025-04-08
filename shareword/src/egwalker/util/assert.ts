export function assert(cond: any, msg: string): asserts cond {
	if (process.env.NODE_ENV !== "production" && !cond) throw new Error(msg);
}

export function assertBounds(n: number, to: number): void {
	if (n < 0 || n >= to) throw new RangeError(`${n} < 0 || ${n} >= ${to}`);
}
