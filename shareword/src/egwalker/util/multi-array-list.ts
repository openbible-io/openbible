// JS engines perform better with homogenous typed arrays.
// This converts an Array of Structs to Struct of Arrays.
// Name inspired by Zig.

// biome-ignore lint/suspicious/noExplicitAny: Interface design.
export class MultiArrayList<T extends { [key: string]: any }> {
	fields: { [k in keyof T]: T[k][] };
	/** For fast length. */
	#lastField: keyof T = "";

	constructor(shape: T) {
		// @ts-ignore Every key is about to be assigned.
		this.fields = {};
		for (const k of Object.keys(shape)) {
			this.fields[k as keyof T] = [];
			this.#lastField = k as keyof T; 
		}
	}

	at(idx: number): T | undefined {
		if (idx < 0 || idx >= this.length) return;

		const res: Partial<T> = {};
		for (const k of Object.keys(this.fields))
			res[k as keyof T] = this.fields[k][idx];
		return res as T;
	}

	push(item: T) {
		for (const [k, v] of Object.entries(item)) this.fields[k].push(v);
	}

	get length(): number {
		return this.fields[this.#lastField].length;
	}
}
