import { assert } from "./assert";

export interface NodeI<K, V> {
	get size(): number;

	min(): K;
	max(): K;
	get(key: K, tree: BTree<K, V, any, any>): V | undefined;
	set(key: K, value: V, tree: BTree<K, V, any, any>): this | undefined;
	items(low: K, high: K, tree: BTree<K, V, any, any>): NodeGenerator<K, V>;
}

type NodeGenerator<K, V> = Generator<{
	node: Leaf<K, V>;
	i: number;
	offset: number;
}>;

export class BTree<
	K,
	V,
	LeafT extends NodeI<K, V> = any,
	InternalT extends NodeI<K, V> = any,
> {
	root?: LeafT | InternalT;
	#size = 0;

	public constructor(
		public indexOf: (ctx: LeafT | InternalT, key: K) => { idx: number, offset: number },
		public maxNodeSize = 1 << 8,
		public newLeaf = (keys?: K[], values?: V[]): LeafT =>
			new Leaf<K, V>(keys, values) as unknown as LeafT,
		public newInternal = (children: any[], keys?: K[]): InternalT =>
			new Internal<K, V, any>(children, keys) as unknown as InternalT,
	) {}

	get size(): number {
		return this.#size;
	}

	min(): K | undefined {
		return this.root?.min();
	}

	max(): K | undefined {
		return this.root?.max();
	}

	get(key: K): V | undefined {
		return this.root?.get(key, this);
	}

	set(key: K, value: V): void {
		this.root ??= this.newLeaf();
		const split = this.root.set(key, value, this);
		if (split) this.root = this.newInternal([this.root, split]);
		this.#size++;
	}

	*nodes(low = this.min(), high = this.max()): NodeGenerator<K, V> {
		if (low !== undefined && high !== undefined && this.root)
			yield* this.root.items(low, high, this);
	}

	*keys(low = this.min(), high = this.max()): Generator<K> {
		for (const { node, i } of this.nodes(low, high)) yield node.keys[i];
	}

	*values(low = this.min(), high = this.max()): Generator<V> {
		for (const { node, i } of this.nodes(low, high)) yield node.values[i];
	}
}

export class Leaf<K, V> implements NodeI<K, V> {
	constructor(
		public keys: K[] = [],
		public values: V[] = [],
	) {}

	get size(): number {
		return this.keys.length;
	}

	min(): K {
		return this.keys[0];
	}

	max(): K {
		return this.keys[this.keys.length - 1];
	}

	get(key: K, tree: BTree<K, V>): V | undefined {
		const { idx, offset } = tree.indexOf(this, key);
		if (offset) return;
		return this.values[idx];
	}

	set(key: K, value: V, tree: BTree<K, V>): undefined | this {
		const { idx } = tree.indexOf(this, key);

		this.keys.splice(idx, 0, key);
		this.values.splice(idx, 0, value);
		return this.maybeSplit(tree);
	}

	maybeSplit(tree: BTree<K, V>): undefined | this {
		if (this.size > tree.maxNodeSize) {
			const half = this.size >> 1;
			const keys = this.keys.splice(half);
			const values = this.values.splice(half);
			// This type hack keeps Typescript happy
			return tree.newLeaf(keys, values) as this;
		}
	}

	*items(low: K, high: K, tree: BTree<K, V>): NodeGenerator<K, V> {
		const start = tree.indexOf(this, low);
		const end = tree.indexOf(this, high);

		for (let i = start.idx; i <= end.idx && i < this.size; i++) {
			yield {
				node: this,
				i,
				offset: i === start.idx ? start.offset : i === end.idx ? end.offset : 0,
			};
		}
	}
}

export class Internal<K, V, C extends NodeI<K, V>> implements NodeI<K, V> {
	constructor(
		public children: C[],
		public keys: K[] = children.map((c) => c.max()),
	) {}

	get size(): number {
		return this.children.length;
	}

	min(): K {
		return this.children[0].min();
	}

	max(): K {
		return this.keys[this.keys.length - 1];
	}

	get(key: K, tree: BTree<K, V>): V | undefined {
		const { idx } = tree.indexOf(this, key);
		return this.children[idx].get(key, tree);
	}

	set(key: K, value: V, tree: BTree<K, V>): undefined | this {
		let { idx } = tree.indexOf(this, key);
		idx = Math.min(idx, this.children.length - 1);
		const child: C = this.children[idx];

		const result = child.set(key, value, tree);
		this.keys[idx] = child.max();
		if (!result) return;

		this.insertChild(idx + 1, result);
		return this.maybeSplit(tree);
	}

	maybeSplit(tree: BTree<K, V>): undefined | this {
		if (this.size > tree.maxNodeSize) {
			const half = this.size >> 1;
			return tree.newInternal(
				this.children.splice(half),
				this.keys.splice(half),
			) as this;
		}
	}

	insertChild(i: number, child: C) {
		this.children.splice(i, 0, child);
		this.keys.splice(i, 0, child.max());
	}

	*items(low: K, high: K, tree: BTree<K, V>): NodeGenerator<K, V> {
		const start = tree.indexOf(this, low);
		const end = tree.indexOf(this, high);
		for (let i = start.idx; i <= end.idx && i < this.size; i++)
			yield* this.children[i].items(low, high, tree);
	}
}

/** Debug functions that may be tree-shaken. */
let counter = 0;
export function toDot(tree: BTree<any, any>): string {
	let res = "digraph {\n";
	if (tree.root) res += nodeToDot(tree, "", tree.root);
	res += "}";
	return res;
}

function nodeToDot(
	tree: BTree<any, any>,
	fromId: string,
	node: NodeI<any, any>,
): string {
	let res = "";

	const id = `i${counter++}`;
	const min = JSON.stringify(node.min(), null, 2).replaceAll('"', '\\"');
	const max = JSON.stringify(node.max(), null, 2).replaceAll('"', '\\"');
	res += `${id}[label="min: ${min}\nmax: ${max}\nsize: ${node.size}"]\n`;
	if (fromId) res += `${fromId} -> ${id}\n`;

	if (node instanceof Internal) {
		for (let i = 0; i < node.children.length; i++) {
			assert(node.children[i], `bad ${i}`);
			res += nodeToDot(tree, id, node.children[i]);
		}
	}

	return res;
}

export function depth(tree: BTree<any, any>): number {
	let node = tree.root;
	let res = -1;
	while (node) {
		res++;
		node = node instanceof Internal ? node.children[0] : undefined;
	}
	return res;
}

