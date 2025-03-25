import { advanceFrontier, type OpLog } from "./oplog";
import { EgWalker, State, type Item, type Snapshot } from "./egwalker";
import type { Accumulator, Clock } from "./oplog-rle";
//import BTree from "./util/btree";

class ListSnapshot<T> implements Snapshot<T> {
	//snapshot = new BTree<Clock, T>((a, b) => a - b);
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
}

export class Branch<T, AccT extends Accumulator<T>> extends ListSnapshot<T> {
	frontier: Clock[] = [];

	checkout(oplog: OpLog<T, AccT>, mergeFrontier: Clock[] = oplog.frontier) {
		const { head, shared, bOnly } = oplog.diffBetween2(
			this.frontier,
			mergeFrontier,
		);

		const doc = new EgWalker<T, AccT>();
		doc.currentVersion = head;

		const placeholderLength = Math.max(...this.frontier) + 1;
		const placeholderOffset = oplog.length;
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

		for (const c of shared) doc.doOp(oplog, c);
		for (const c of bOnly) {
			doc.doOp(oplog, c, this);
			this.frontier = advanceFrontier(this.frontier, c, oplog.getParents(c));
		}
	}
}
