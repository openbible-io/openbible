import binarySearch from "./bsearch";

type NodeGenerator<K, V> = Generator<{ node: Node<K, V>; i: number }>;

export default class BTree<K, V> {
	root?: Node<K, V>;
	length = 0;

	public constructor(
		public comparator: (a: K, b: K) => number,
		public maxNodeSize = 1 << 8,
	) {}

	min(): K | undefined {
		return this.root?.min();
	}

	max(): K | undefined {
		return this.root?.max();
	}

	get(key: K): V | undefined {
		return this.root?.get(key, this);
	}

	set(key: K, value: V): boolean {
		this.root ??= new Node<K, V>();
		const split = this.root.set(key, value, this);
		if (split) this.root = new NodeInternal<K, V>([this.root, split]);
		return true;
	}

	*nodes(low = this.min(), high = this.max()): NodeGenerator<K, V> {
		if (low !== undefined && high !== undefined && this.root)
			yield* this.root.items(low, high, this);
	}

	delete(key: K): boolean {
		for (const { node, i } of this.nodes(key, key)) {
			node.keys.splice(i, 1);
			node.values.splice(i, 1);
			this.length--;
			this.cleanup();
			return true;
		}
		return false;
	}

	/** Call after deletion to maybe hoist root. */
	cleanup(): void {
		while (
			this.root &&
			this.root.keys.length <= 1 &&
			this.root instanceof NodeInternal
		) {
			this.root = this.root.keys.length ? this.root.children[0] : undefined;
		}
	}

	depth(): number {
		let node: Node<K, V> | undefined = this.root;
		let res = -1;
		while (node) {
			res++;
			node = node instanceof NodeInternal ? node.children[0] : undefined;
		}
		return res;
	}
}

class Node<K, V> {
	keys: K[];
	values: V[];

	constructor(keys: K[] = [], values: V[] = []) {
		this.keys = keys;
		this.values = values;
	}

	min(): K {
		return this.keys[0];
	}

	max(): K {
		return this.keys[this.keys.length - 1];
	}

	protected indexOf(
		key: K,
		failXor: number,
		comparator: (a: K, b: K) => number,
	): number {
		return binarySearch(this.keys, key, comparator, failXor);
	}

	get(key: K, tree: BTree<K, V>): V | undefined {
		return this.values[this.indexOf(key, -1, tree.comparator)];
	}

	set(key: K, value: V, tree: BTree<K, V>): undefined | Node<K, V> {
		let i = this.indexOf(key, -1, tree.comparator);
		if (i < 0) {
			i = ~i;
			tree.length++;

			this.insert(i, key, value);
			if (this.keys.length >= tree.maxNodeSize) return this.splitRight();
		}
		this.keys[i] = key;
		this.values[i] = value;
	}

	private insert(i: number, key: K, value: V): void {
		this.keys.splice(i, 0, key);
		this.values.splice(i, 0, value);
	}

	takeRight(rhs: Node<K, V>): void {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.values.push(rhs.values.shift()!);
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.keys.push(rhs.keys.shift()!);
	}

	takeLeft(lhs: Node<K, V>): void {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.values.unshift(lhs.values.pop()!);
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.keys.unshift(lhs.keys.pop()!);
	}

	splitRight(): Node<K, V> {
		const half = this.keys.length >> 1;
		const keys = this.keys.splice(half);
		const values = this.values.splice(half);
		return new Node<K, V>(keys, values);
	}

	*items(low: K, high: K, tree: BTree<K, V>): NodeGenerator<K, V> {
		let iLow: number;
		let iHigh: number;
		if (high === low) {
			iHigh = (iLow = this.indexOf(low, -1, tree.comparator)) + 1;
			if (iLow < 0) return;
		} else {
			iLow = this.indexOf(low, 0, tree.comparator);
			iHigh = this.indexOf(high, -1, tree.comparator);
			if (iHigh < 0) iHigh = ~iHigh;
			else iHigh++;
		}
		for (let i = iLow; i < iHigh; i++) {
			yield { node: this, i };
		}
	}

	mergeSibling(rhs: Node<K, V>, _: number) {
		this.keys.push(...rhs.keys);
		this.values.push(...rhs.values);
	}
}

class NodeInternal<K, V> extends Node<K, V> {
	constructor(
		public children: Node<K, V>[],
		keys: K[] = children.map((c) => c.max()),
	) {
		super(keys);
	}

	override min(): K {
		return this.children[0].min();
	}

	override get(key: K, tree: BTree<K, V>): V | undefined {
		const i = this.indexOf(key, 0, tree.comparator);
		return i < this.children.length
			? this.children[i].get(key, tree)
			: undefined;
	}

	override set(
		key: K,
		value: V,
		tree: BTree<K, V>,
	): undefined | NodeInternal<K, V> {
		const i = Math.min(
			this.indexOf(key, 0, tree.comparator),
			this.children.length - 1,
		);
		const child = this.children[i];

		if (child.keys.length >= tree.maxNodeSize) {
			let other: Node<K, V>;
			if (
				i > 0 &&
				(other = this.children[i - 1]).keys.length < tree.maxNodeSize &&
				tree.comparator(child.keys[0], key) < 0
			) {
				other.takeRight(child);
				this.keys[i - 1] = other.max();
			} else if (
				(other = this.children[i + 1]) &&
				other.keys.length < tree.maxNodeSize &&
				tree.comparator(child.max(), key) < 0
			) {
				other.takeLeft(child);
				this.keys[i] = this.children[i].max();
			}
		}

		const result = child.set(key, value, tree);
		this.keys[i] = child.max();
		if (!result) return;

		this.insertChild(i + 1, result);
		if (this.keys.length >= tree.maxNodeSize) return this.splitRight();
	}

	insertChild(i: number, child: Node<K, V>) {
		this.children.splice(i, 0, child);
		this.keys.splice(i, 0, child.max());
	}

	override splitRight() {
		const half = this.children.length >> 1;
		return new NodeInternal<K, V>(
			this.children.splice(half),
			this.keys.splice(half),
		);
	}

	override takeRight(rhs: NodeInternal<K, V>) {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.keys.push(rhs.keys.shift()!);
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.children.push(rhs.children.shift()!);
	}

	override takeLeft(lhs: NodeInternal<K, V>) {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.keys.unshift(lhs.keys.pop()!);
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.children.unshift(lhs.children.pop()!);
	}

	override *items(low: K, high: K, tree: BTree<K, V>): NodeGenerator<K, V> {
		let iLow = this.indexOf(low, 0, tree.comparator);
		const iHigh = Math.min(
			high === low ? iLow : this.indexOf(high, 0, tree.comparator),
			this.keys.length - 1,
		);
		if (iLow > iHigh) return;

		for (let i = iLow; i <= iHigh; i++)
			yield* this.children[i].items(low, high, tree);

		// cleanup
		const half = tree.maxNodeSize >> 1;
		if (iLow > 0) iLow--;
		for (let i = iHigh; i >= iLow; i--) {
			if (this.children[i].keys.length > half) continue;

			if (this.children[i].keys.length) {
				this.tryMerge(i, tree.maxNodeSize);
			} else {
				this.keys.splice(i, 1);
				this.children.splice(i, 1);
			}
		}
	}

	tryMerge(i: number, maxSize: number): boolean {
		const children = this.children;

		if (i >= 0 && i + 1 < children.length) {
			if (children[i].keys.length + children[i + 1].keys.length <= maxSize) {
				children[i].mergeSibling(children[i + 1], maxSize);
				children.splice(i + 1, 1);
				this.keys.splice(i + 1, 1);
				this.keys[i] = children[i].max();
				return true;
			}
		}
		return false;
	}

	override mergeSibling(rhs: NodeInternal<K, V>, maxNodeSize: number) {
		const prevLen = this.keys.length;

		this.keys.push(...rhs.keys);
		this.children.push(...rhs.children);
		this.tryMerge(prevLen - 1, maxNodeSize);
	}
}
