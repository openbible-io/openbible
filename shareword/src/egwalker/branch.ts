import { advanceFrontier, type OpLog } from "./oplog";
import { EgWalker, State, type Item, type Snapshot } from "./egwalker";
import type { Accumulator, Clock } from "./oplog-rle";

class ListSnapshot<T> implements Snapshot<T> {
	data: T[] = [];

	insert(pos: number, items: Accumulator<T>) {
		this.data.splice(pos, 0, ...items);
	}

	delete(pos: number, delCount: number) {
		this.data.splice(pos, delCount);
	}

	get length() {
		return this.data.length;
	}

	*items() {
		for (const d of this.data) yield d;
	}
}

//import BTree from "./util/btree";
//class BTreeSnapshot<T> implements Snapshot<T> {
//	snapshot = new BTree<Clock, T>((a, b) => a - b);
//
//	insert(pos: number, items: Accumulator<T>) {
//		for (let i = 0; i < items.length; i++) {
//			console.log("insert", pos + i, items[i]);
//			this.snapshot.set(pos + i, items[i]);
//		}
//	}
//
//	delete(pos: number, delCount: number) {
//		for (let i = 0; i < delCount; i++) {
//			console.log("delete", pos + i);
//			this.snapshot.delete(pos + i);
//		}
//	}
//
//	get length() {
//		return this.snapshot.length;
//	}
//
//	*items() {
//		yield* this.snapshot.values();
//	}
//}

export class Branch<T, AccT extends Accumulator<T>> extends ListSnapshot<T> {
	frontier: Clock[] = [];

	checkout(oplog: OpLog<T, AccT>, mergeFrontier: Clock[] = oplog.frontier) {
		const { head, shared, bOnly } = oplog.diffBetween2(
			this.frontier,
			mergeFrontier,
		);

		const doc = new EgWalker(oplog);
		doc.currentVersion = head;

		const placeholderLength = Math.max(...this.frontier) + 1;
		const placeholderOffset = oplog.length; // @seph: is this correct?
		for (let i = 0; i < placeholderLength; i++) {
			const item: Item = {
				clock: i + placeholderOffset,
				state: State.Inserted,
				deleted: false,
				originLeft: -1,
				originRight: -1,
			};
			doc.items.push(item);
			doc.targets[item.clock] = item;
		}

		for (const c of shared) doc.applyOp(c);
		for (const c of bOnly) {
			doc.applyOp(c, this);
			this.frontier = advanceFrontier(this.frontier, c, oplog.getParents(c));
		}
	}
}
