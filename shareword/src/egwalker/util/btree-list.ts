import { BTree, Internal, Leaf, type NodeI } from "./btree";

interface ListNode<V> extends NodeI<number, V> {
	length: number;
}

/**
 * A grow-only balanced tree:
 * - Keys are lengths of values.
 * - Node have an extra `length` field.
 * - Supports insertion by list position.
 */
export class BTreeList<V> extends BTree<number, V, LeafStat<V>, InternalStat<V, any>> {
	constructor(
		public valueLen: (value: V) => number,
		public slice: (value: V, start: number, end?: number) => V,
		public maxNodeSize = 1 << 8,
	) {
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
			(keys?: number[], values?: V[]) => new LeafStat<V>(keys, values),
			(children: any[], keys?: number[]) => new InternalStat<V, any>(children, keys),
		);
	}

	get length(): number {
		return this.root?.length ?? 0;
	}
}

export class LeafStat<V> extends Leaf<number, V> implements NodeI<number, V> {
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
		return tree.slice(value, offset);
	}

	set(key: number, value: V, tree: BTreeList<V>): undefined | this {
		const { idx, offset } = tree.indexOf(this, key);
		const len = tree.valueLen(value);
		console.log("set", key, idx, offset);

		if (idx === this.size - 1 && offset === this.keys[this.size - 1]) {
			this.keys.push(len);
			this.values.push(value);
		} else if (!offset) {
			this.keys.unshift(len);
			this.values.unshift(value);
		} else {
			const endLen = this.keys[idx] - offset;
			const end = tree.slice(this.values[idx], offset);
			this.values[idx] = tree.slice(this.values[idx], 0, offset);
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

export class InternalStat<V, C extends ListNode<V>>
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
		idx = Math.min(idx, this.children.length - 1);
		const child: C = this.children[idx];

		const result = child.set(pos - offset, value, tree);
		this.keys[idx] = child.max();
		this.length += tree.valueLen(value);
		if (!result) return;

		this.insertChild(idx + 1, result);

		const res = this.maybeSplit(tree);
		if (res) this.length -= res.length;
		return res;
	}
}
