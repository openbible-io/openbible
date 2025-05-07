import type { Run } from "../oplog/op";
import { BTree, Internal, Leaf, type NodeI } from "./btree";

interface ListNode<V> extends NodeI<number, V> {
	length: number;
}

/**
 * A balanced tree that supports insertion and lookup by list position:
 * - Nodes have an extra `length` field.
 * - Keys are lengths of values and can be negative for deletions.
 * - Grow only for simpler implementation.
 */
export class BTreeList<V extends Run> extends BTree<number, V, LeafStat<V>, InternalStat<V, any>> {
	constructor(maxNodeSize = 1 << 8, splitNodeSize = Math.floor(maxNodeSize * 0.8)) {
		super(
			(ctx, pos) => {
				const lengths = ctx.keys;
				let endPos = 0;
				let i = 0;
				for (i = 0; i < lengths.length; i++) {
					endPos += lengths[i];
					if (endPos >= pos) break;
				}
				return { idx: i, offset: pos - endPos + (lengths[i] ?? 0) };
			},
			maxNodeSize,
			splitNodeSize,
			(keys?: number[], values?: V[]) => new LeafStat<V>(keys, values),
			(children: any[], keys?: number[]) => new InternalStat<V, any>(children, keys),
		);
	}

	get length(): number {
		return this.root?.length ?? 0;
	}
}

export class LeafStat<V extends Run> extends Leaf<number, V> implements NodeI<number, V> {
	constructor(
		public keys: number[] = [],
		public values: V[] = [],
		public length = keys.reduce((acc, cur) => acc + cur, 0),
	) {
		super(keys, values);
	}

	min() {
		return 0;
	}

	max() {
		return this.length;
	}

	get(pos: number, tree: BTreeList<V>): V | undefined {
		const { idx, offset } = tree.indexOf(this, pos);
		const value = this.values[idx];
		return value.slice(offset);
	}

	set(pos: number, value: V, tree: BTreeList<V>): undefined | this {
		const { idx, offset } = tree.indexOf(this, pos);
		const len = value.length;
		// console.log("set", key, value, this.keys, this.values, idx, offset);

		if (idx === this.size - 1 && offset === this.keys[this.size - 1]) {
			// end
			this.keys.push(len);
			this.values.push(value);
		} else if (!offset) {
			// start
			this.keys.unshift(len);
			this.values.unshift(value);
		} else {
			// middle
			const endLen = this.keys[idx] - offset;
			const end = this.values[idx].slice(offset);
			this.values[idx] = this.values[idx].slice(0, offset);
			this.keys[idx] = offset;

			const lens = [len];
			const values = [value];
			if (endLen) {
				lens.push(endLen);
				values.push(end);
			}

			this.keys.splice(idx + 1, 0, ...lens);
			this.values.splice(idx + 1, 0, ...values);
		}
		this.length += len;

		const res = this.maybeSplit(tree);
		if (res) this.length -= res.length;
		return res;
	}
}

export class InternalStat<V extends Run, C extends ListNode<V>>
	extends Internal<number, V, C>
	implements NodeI<number, V>
{
	constructor(
		public children: C[],
		public keys: number[] = children.map((c) => c.max()),
		public length = keys.reduce((acc, cur) => acc + cur, 0),
	) {
		super(children, keys);
	}

	min() {
		return 0;
	}

	max() {
		return this.length;
	}

	get(pos: number, tree: BTree<number, V>): V | undefined {
		const { idx, offset } = tree.indexOf(this, pos);
		return this.children[idx]?.get(pos - offset, tree);
	}

	set(pos: number, value: V, tree: BTreeList<V>): undefined | this {
		let { idx, offset } = tree.indexOf(this, pos);
		idx = Math.min(idx, this.size - 1);
		const child: C = this.children[idx];

		const result = child.set(offset, value, tree);
		this.keys[idx] = child.max();
		this.length += value.length;

		if (!result) return;

		this.insertChild(idx + 1, result);

		const res = this.maybeSplit(tree);
		if (res) this.length -= res.length;
		return res;
	}
}
