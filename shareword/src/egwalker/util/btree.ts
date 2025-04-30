type ValueGenerator<V> = Generator<{ value: V; len: number }>;

/**
 * A grow-only balanced tree:
 * - Keys are lengths.
 * - Supports insertion by list position.
 */
export class BTree<V> {
	root?: Node<V>;

	public constructor(
		public slice: (value: V, start: number, end?: number) => V,
		public maxNodeSize = 16,
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
		if (pos > this.length)
			throw new RangeError(`insertion at position ${pos} > ${this.length}`);

		this.root ??= new Node<V>();
		const maybeSplit = this.root.insert(pos, value, len, this);
		if (maybeSplit) this.root = new InternalNode<V>([this.root, maybeSplit]);
	}

	*iter(low = 0, high = this.length): ValueGenerator<V> {
		if (this.root) yield* this.root.iter(this, low, high);
	}
}

let counter = 0;
export function treeToDot<T>(tree: BTree<T>): string {
	let res = "digraph {\n";
	if (tree.root) res += nodeToDot(tree, "", tree.root);
	res += "}";
	return res;
}

function nodeToDot<T>(tree: BTree<T>, fromId: string, node: Node<T>): string {
	let res = "";

	const id = `i${counter++}`;
	res += `${id}[label="${node.length}"]\n`;
	if (fromId) res += `${fromId} -> ${id}\n`;

	if (node instanceof InternalNode) {
		for (let i = 0; i < node.children.length; i++)
			res += nodeToDot(tree, id, node.children[i]);
	} else {
		for (const item of node.iter(tree)) {
			const itemId = `li${counter++}`;
			// JSON.stringify(item, null, 2).replaceAll('"', '\\"')
			res += `${itemId}[label="${item.len}"]\n`;
			res += `${id} -> ${itemId}\n`;
		}
	}

	return res;
}

export function depth<V>(tree: BTree<V>): number {
	let node = tree.root;
	let res = -1;
	while (node) {
		res++;
		node = node instanceof InternalNode ? node.children[0] : undefined;
	}
	return res;
}

/**
 * Iterates through `lengths` until reaches `pos`.
 */
function indexOf(
	lengths: number[],
	pos: number,
): { idx: number; offset: number } {
	let endPos = 0;
	let i = 0;
	for (i = 0; i < lengths.length; i++) {
		endPos += lengths[i];
		if (endPos >= pos) break;
	}
	return { idx: i, offset: pos - endPos + (lengths[i] ?? 0) };
}

/** Leaf node or internal node. Internal node overrides MOST methods. */
export class Node<V> {
	constructor(
		public lengths: number[] = [],
		public values: V[] = [],
		public length = lengths.reduce((acc, cur) => acc + cur, 0),
	) {}

	get size(): number {
		return this.lengths.length;
	}

	indexOf(pos: number): { idx: number; offset: number } {
		return indexOf(this.lengths, pos);
	}

	get(pos: number, tree: BTree<V>): V | undefined {
		const { idx, offset } = this.indexOf(pos);
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
		const { idx, offset } = this.indexOf(pos);

		if (
			idx === this.size - 1 &&
			offset === this.lengths[this.size - 1]
		) {
			this.lengths.push(len);
			this.values.push(value);
		} else if (!offset) {
			this.lengths.unshift(len);
			this.values.unshift(value);
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
		if (this.size > tree.maxNodeSize) return this.splitRight();
	}

	takeRight(rhs: Node<V>): number {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		const length = rhs.lengths.shift()!;
		this.lengths.push(length);
		this.length += length;
		rhs.length -= length;
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.values.push(rhs.values.shift()!);
		return length;
	}

	takeLeft(lhs: Node<V>): number {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		const length = lhs.lengths.pop()!;
		this.lengths.unshift(length);
		this.length += length;
		lhs.length -= length;
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.values.unshift(lhs.values.pop()!);
		return length;
	}

	splitRight(): Node<V> {
		const half = this.size >> 1;
		const lengths = this.lengths.splice(half);
		const values = this.values.splice(half);
		const res = new Node<V>(lengths, values);
		this.length -= res.length;
		return res;
	}

	*iter(tree: BTree<V>, low = 0, high = this.length): ValueGenerator<V> {
		const { idx, offset } = this.indexOf(low);
		let pos = low;
		let start = offset;
		let end: number | undefined;

		for (let i = idx; i < this.size && pos < high; i++) {
			const value = this.values[i];
			const len = this.lengths[i];

			if (pos > high) end = pos - high;
			yield {
				value: start || end ? tree.slice(value, start, end) : value,
				len,
			};

			pos += len;
			start = 0;
		}
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

	get(pos: number, tree: BTree<V>): V | undefined {
		const { idx, offset } = this.indexOf(pos);
		return this.children[idx]?.get(pos - offset, tree);
	}

	insert(
		pos: number,
		value: V,
		len: number,
		tree: BTree<V>,
	): undefined | InternalNode<V> {
		let { idx, offset } = this.indexOf(pos);
		const child = this.children[idx];

		if (child.size >= tree.maxNodeSize) {
			let other: (typeof this.children)[number];
			if (idx > 0 && (other = this.children[idx - 1]).size < tree.maxNodeSize) {
				//assert(child.constructor === other.constructor, "monomorphic children");
				offset -= other.takeRight(child);
				this.lengths[idx - 1] = other.length;
				offset = this.indexOf(pos).offset;
			} else if (
				(other = this.children[idx + 1]) &&
				other.size < tree.maxNodeSize
			) {
				offset += other.takeLeft(child);
				this.lengths[idx] = this.children[idx].length;
				offset = this.indexOf(pos).offset;
			}
		}

		const result = child.insert(offset, value, len, tree);
		this.lengths[idx] = child.length;
		this.length += len;
		if (!result) return;

		this.insertChild(idx + 1, result);
		if (this.size > tree.maxNodeSize) return this.splitRight();
	}

	insertChild(i: number, child: Node<V>) {
		this.children.splice(i, 0, child);
		this.lengths.splice(i, 0, child.length);
	}

	splitRight(): InternalNode<V> {
		const half = this.children.length >> 1;
		const res = new InternalNode<V>(
			this.children.splice(half),
			this.lengths.splice(half),
		);
		this.length -= res.length;
		return res;
	}

	takeRight(rhs: InternalNode<V>): number {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		const length = rhs.lengths.shift()!;
		this.lengths.push(length);
		this.length += length;
		rhs.length -= length;
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.children.push(rhs.children.shift()!);

		return length;
	}

	takeLeft(lhs: InternalNode<V>): number {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		const length = lhs.lengths.pop()!;
		this.lengths.unshift(length);
		this.length += length;
		lhs.length -= length;
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		this.children.unshift(lhs.children.pop()!);

		return length;
	}

	*iter(tree: BTree<V>, low = 0, high = this.length): ValueGenerator<V> {
		const { idx, offset } = this.indexOf(low);
		let pos = low - offset;

		for (let i = idx; i < this.size && pos < high; i++) {
			yield* this.children[i].iter(tree, pos, high);
			pos += this.lengths[i];
		}
	}
}
