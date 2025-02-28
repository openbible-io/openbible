export type SliceOp<T> = { pos: number; deleteCount: number, item?: T};

/*
 * An append-only array of splice events.
 */
export default class List<T> {
	positions: number[] = [];
	deleteCounts: number[] = [];
	items: T[] = [];
	// Allows some optimizations.
	emptyElement: T;

	constructor(emptyElement: T) {
		this.emptyElement = emptyElement;
	}

	splice(pos: number, deleteCount: number, item?: T) {
		this.positions.push(pos);
		this.deleteCounts.push(deleteCount);
		this.items.push(item ?? this.emptyElement);
	}

	insert(pos: number, item: T) {
		this.splice(pos, 0, item);
	}

	delete(pos: number, len: number) {
		this.splice(pos, len);
	}

	values(): T[] {
		const res: T[]  = [];
		//assert(this.positions.length === this.deleteCounts.length);
		//assert(this.positions.length === this.items.length);
		for (let i = 0; i < this.positions.length; i++) {
			res.splice(this.positions[i], this.deleteCounts[i], this.items[i]);
		}

		return res;
	}
}
