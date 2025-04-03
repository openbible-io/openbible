/**
 * A map that also stores its keys as a list for fast lookup.
 *
 * Good for small maps.
 */
export class ListMap<K extends keyof any> {
	keys: K[] = [];
	map = {} as Record<K, number>;

	getOrPut(k: K): number {
		if (!(k in this.map)) {
			this.map[k] = this.keys.length;
			this.keys.push(k);
		}

		return this.map[k];
	}
}
