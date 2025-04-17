//type NodeGenerator<V> = Generator<{ node: Node<V>; i: number }>;

/**
 * A grow-only balanced tree. Supports insertion by list position.
 */
export class BTree<V> {
	root?: Node<V>;

	public constructor(
		public slice: (value: V, start: number, end?: number) => V,
		public maxNodeSize = 1 << 8,
	) {}

	get length(): number {
		return this.root?.length ?? 0;
	}

	get(pos: number): V | undefined {
		return this.root?.get(pos, this);
	}

	/** @param len Use negative length for deletions. */
	insert(pos: number, value: V, len: number): void {
		if (!len) return;

		this.root ??= new Node<V>();
		const maybeSplit = this.root.insert(pos, value, len, this);
		if (maybeSplit) this.root = new InternalNode<V>([this.root, maybeSplit]);
	}

	//*nodes(low = this.min(), high = this.max()): NodeGenerator<K, V> {
	//	if (low !== undefined && high !== undefined && this.root)
	//		yield* this.root.items(low, high, this);
	//}
	//
	//*values(low = this.min(), high = this.max()): Generator<V> {
	//	for (const { node, i } of this.nodes(low, high))
	//		yield node.values[i];
	//}
}

//depth(): number {
//	let node: Node<K, V> | undefined = this.root;
//	let res = -1;
//	while (node) {
//		res++;
//		node = node instanceof NodeInternal ? node.children[0] : undefined;
//	}
//	return res;
//}

function indexOf(lengths: number[], pos: number): { idx: number, offset: number } {
	let endPos = 0;
	let i = 0;
	for (i = 0; i < lengths.length; i++) {
		endPos += lengths[i];
		if (endPos >= pos) break;
	}
	return { idx: i, offset: pos - endPos + (lengths[i] ?? 0) };
}

/** Leaf node or internal node. Internal node overrides ALL methods. */
export class Node<V> {
	constructor(
		public lengths: number[] = [],
		public values: V[] = [],
		public length = lengths.reduce((acc, cur) => acc + cur, 0),
	) {}

	#indexOf(pos: number): { idx: number, offset: number } {
		return indexOf(this.lengths, pos);
	}

	get(pos: number, tree: BTree<V>): V | undefined {
		const { idx, offset } = this.#indexOf(pos);
		const value = this.values[idx];
		return tree.slice(value, offset);
	}

	/** @returns new node if split */
	insert(
		pos: number,
		value: V,
		len: number,
		tree: BTree<V>,
	): undefined | Node<V> {
		const { idx, offset } = this.#indexOf(pos);
		//console.log("insert", pos, value, len, idx, offset);

		if (offset === 0 || offset === this.length) {
			this.lengths.splice(idx, 0, len);
			this.values.splice(idx, 0, value);
		} else {
			const endLen = this.lengths[idx] - offset;
			const end = tree.slice(this.values[idx], offset);
			this.values[idx] = tree.slice(this.values[idx], 0, offset);
			this.lengths[idx] = offset;

			const lens = [len];
			const values = [value];
			if (endLen) {
				lens.push(endLen);
				values.push(end);
			}

			this.lengths.splice(idx + 1, 0, ...lens);
			this.values.splice(idx + 1, 0, ...values);
		}
		this.length += len;
		if (this.lengths.length >= tree.maxNodeSize) return this.splitRight();
	}

	takeRight(rhs: Node<V>): void {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.lengths.push(rhs.lengths.shift()!);
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.values.push(rhs.values.shift()!);
	}

	takeLeft(lhs: Node<V>): void {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.lengths.unshift(lhs.lengths.pop()!);
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.values.unshift(lhs.values.pop()!);
	}

	splitRight(): Node<V> {
		const half = this.lengths.length >> 1;
		const lengths = this.lengths.splice(half);
		const values = this.values.splice(half);
		return new Node<V>(lengths, values);
	}

	//*items(low: K, high: K, tree: BTree<K, V>): NodeGenerator<K, V> {
	//	let iLow: number;
	//	let iHigh: number;
	//	if (high === low) {
	//		iHigh = (iLow = this.indexOf(low, -1, tree.comparator)) + 1;
	//		if (iLow < 0) return;
	//	} else {
	//		iLow = this.indexOf(low, 0, tree.comparator);
	//		iHigh = this.indexOf(high, -1, tree.comparator);
	//		if (iHigh < 0) iHigh = ~iHigh;
	//		else iHigh++;
	//	}
	//	for (let i = iLow; i < iHigh; i++) yield { node: this, i };
	//}

	mergeSibling(rhs: Node<V>, _maxNodeSize: number): void {
		this.lengths.push.apply(rhs.lengths);
		this.values.push.apply(rhs.values);
	}
}

export class InternalNode<V> extends Node<V> {
	constructor(
		public children: Node<V>[], // Reality: InternalNode<V>[] | LeafNode<V>[]
		public lengths: number[] = children.map((c) => c.length),
	) {
		// This is ugly and needlessly has a `values` field. It's purely to please
		// Typescript.
		// I tried making a generic Children type parameter to no avail.
		//
		// May you fair better.
		super(lengths, []);
	}

	#indexOf(pos: number) {
		return indexOf(this.lengths, pos);
	}

	get(pos: number, tree: BTree<V>): V | undefined {
		const { idx, offset } = this.#indexOf(pos);
		return this.children[idx]?.get(pos - offset, tree)
	}

	insert(
		pos: number,
		value: V,
		len: number,
		tree: BTree<V>,
	): undefined | InternalNode<V> {
		const i = this.#indexOf(pos).idx;
		const child = this.children[i];

		if (child.lengths.length >= tree.maxNodeSize) {
			let other: typeof this.children[number];
			if (
				i > 0 &&
				(other = this.children[i - 1]).lengths.length < tree.maxNodeSize
			) {
				//assert(child.constructor === other.constructor, "monomorphic children");
				other.takeRight(child);
				this.lengths[i - 1] = other.length;
			} else if (
				(other = this.children[i + 1]) &&
				other.lengths.length < tree.maxNodeSize
			) {
				other.takeLeft(child);
				this.lengths[i] = this.children[i].length;
			}
		}

		const result = child.insert(pos, value, len, tree);
		this.lengths[i] = child.length;
		if (!result) return;

		this.insertChild(i + 1, result);
		if (this.lengths.length >= tree.maxNodeSize) return this.splitRight();
	}

	insertChild(i: number, child: Node<V>) {
		// @ts-ignore
		this.children.splice(i, 0, child);
		this.lengths.splice(i, 0, child.length);
	}

	splitRight(): InternalNode<V> {
		const half = this.children.length >> 1;
		return new InternalNode<V>(
			this.children.splice(half),
			this.lengths.splice(half),
		);
	}

	takeRight(rhs: InternalNode<V>): void {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.lengths.push(rhs.lengths.shift()!);
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.children.push(rhs.children.shift()!);
	}

	takeLeft(lhs: InternalNode<V>): void {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.lengths.unshift(lhs.lengths.pop()!);
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.children.unshift(lhs.children.pop()!);
	}

	#tryMerge(i: number, maxSize: number): boolean {
		const children = this.children;

		if (i >= 0 && i + 1 < children.length) {
			if (children[i].lengths.length + children[i + 1].lengths.length <= maxSize) {
				children[i].mergeSibling(children[i + 1], maxSize);
				children.splice(i + 1, 1);
				this.lengths.splice(i + 1, 1);
				this.lengths[i] = children[i].length;
				return true;
			}
		}
		return false;
	}

	//*items(low: K, high: K, tree: BTree<K, V>): NodeGenerator<K, V> {
	//	const iLow = this.indexOf(low, 0, tree.comparator);
	//	const iHigh = Math.min(
	//		high === low ? iLow : this.indexOf(high, 0, tree.comparator),
	//		this.keys.length - 1,
	//	);
	//	if (iLow > iHigh) return;
	//
	//	for (let i = iLow; i <= iHigh; i++)
	//		yield* this.children[i].items(low, high, tree);
	//}

	mergeSibling(rhs: InternalNode<V>, maxNodeSize: number): void {
		const prevLen = this.lengths.length;

		this.lengths.push.apply(rhs.lengths);
		this.children.push.apply(rhs.children);
		this.#tryMerge(prevLen - 1, maxNodeSize);
	}
}
