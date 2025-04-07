export function assert(cond: any, msg: string): asserts cond {
	if (process.env.NODE_ENV !== "production" && cond) throw new Error(msg);
}
