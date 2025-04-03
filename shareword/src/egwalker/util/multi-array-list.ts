/**
 * Converts an Array of Structs to a Struct of Arrays.
 *
 * - JS engines perform better with homogenous typed arrays
 * - Easier and more efficient to serialize
 */
export class MultiArrayList<T extends { [key: string]: any }> {
	fields: { [k in keyof T]: T[k][] };
	/** For fast length. */
	#lastField: keyof T = "";

	// TODO: way to type passing all keys to save also passing values?
	constructor(shape: T) {
		// @ts-ignore Every field is about to be assigned.
		this.fields = {};
		for (const k in shape) {
			this.fields[k as keyof T] = [];
			this.#lastField = k as keyof T;
		}
	}

	get length(): number {
		return this.fields[this.#lastField].length;
	}

	at(idx: number): T | undefined {
		if (idx < 0 || idx >= this.length) return;

		const res: Partial<T> = {};
		for (const k of Object.keys(this.fields))
			res[k as keyof T] = this.fields[k][idx];

		return res as T;
	}

	push(item: T): void {
		for (const [k, v] of Object.entries(item)) this.fields[k].push(v);
	}

	slice(start = 0, end = this.length): MultiArrayList<T> {
		// @ts-ignore Every field is about to be assigned.
		const res = new MultiArrayList<T>({});
		for (const f in this.fields)
			res.fields[f] = this.fields[f].slice(start, end);

		res.#lastField = this.#lastField;

		return res;
	}
}
