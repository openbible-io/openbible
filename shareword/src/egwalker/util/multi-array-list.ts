import { assertBounds } from "./assert";

/**
 * Converts an Array of Structs to a Struct of Arrays.
 *
 * This allows some JS engine optimizations for small integers and
 * easier serialization/deserialization to TypedArrays.
 */
export class MultiArrayList<T extends { [key: string]: any }> {
	/** In order passed to constructor. */
	fields: { [k in keyof T]: T[k][] };
	/** For getting length */
	#lastField: keyof T = "";

	constructor(shape: T) {
		// @ts-ignore Every key is about to be assigned.
		this.fields = {};
		for (const k of Object.keys(shape)) {
			this.fields[k as keyof T] = [];
			this.#lastField = k as keyof T; 
		}
	}

	get length(): number {
		return this.fields[this.#lastField].length;
	}

	at(idx: number): T {
		assertBounds(idx, this.length);

		const res: Partial<T> = {};
		for (const k of Object.keys(this.fields))
			res[k as keyof T] = this.fields[k][idx];
		return res as T;
	}

	push(item: T) {
		for (const [k, v] of Object.entries(item)) this.fields[k].push(v);
	}

	slice(start?: number, end?: number): MultiArrayList<T> {
		const shape: T = {} as T;
		const res = new MultiArrayList<T>(shape);
		for (const f in res.fields) {
			res.fields[f] = this.fields[f].slice(start, end);
		}
		return res;
	}
}
