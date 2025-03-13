import { advanceFrontier, type Clock, type OpLog } from "./oplog";
import { EgWalker, State, type Item } from "./egwalker";

export class Branch<T> {
	snapshot: T[] = [];
	frontier: Clock[] = [];

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	checkout(oplog: OpLog<T, any>, mergeFrontier: Clock[] = oplog.frontier) {
		const { head, shared, bOnly } = oplog.diff2(
			this.frontier,
			mergeFrontier,
		);

		const doc = new EgWalker();
		doc.currentVersion = head;

		const placeholderLength = Math.max(...this.frontier) + 1;
		const placeholderOffset = oplog.nextClock();
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

		for (const lc of shared) doc.doOp(oplog, lc);

		for (const lc of bOnly) {
			doc.doOp(oplog, lc, this.snapshot);
			this.frontier = advanceFrontier(this.frontier, lc, oplog.getParents(lc));
		}
	}
}
