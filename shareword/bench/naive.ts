// Started from https://madebyevan.com/algos/crdt-text-buffer/

/** Unique identifier of `Doc` instance. */
type Site = string;
/** Non-negative integer incremented after each operation */
type Clock = number;

/** Each UTF-16 code unit is assigned a unique identifier. */
type Identifier = {
	site: Site;
	clock: Clock;
};

/**
 * Maps from site identifier to the latest known clock value for that site.
 * This is called the "state vector" because it's a concise representation of
 * the document state at a given site. If two sites have the same state vector
 * then we know they have the same document state. Otherwise, we can use the
 * state vector to compute the minimal information necessary to bring each site
 * up to date with the other's changes.
 */
type StateVector = Record<Site, number>;

type Insert = {
	/** The id of the first UTF16 code unit */
	id: Identifier;
	/** The id of the UTF16 code unit that we come after */
	parent: Identifier | null;
	/** Used to determine the order of inserts with the same parent */
	counter: number;
	/** Multiple UTF16 code units represents multiple clocks */
	content: string;
};

type Delete = {
	/** The id of the first UTF16 code unit */
	id: Identifier;
	/** End of the deleted range, exclusive */
	end: Clock;
	/** All sites that deleted something in this range */
	version: StateVector;
};

export class Doc {
	site: Site;
	/** In document order. */
	inserts: Insert[] = [];
	/** Unordered. */
	deletes: Delete[] = [];
	/** Max clock per-site. */
	version: StateVector = {};

	/**
	 * Make a new doc.
	 *
	 * @param site Unique for each site in the system.
	 */
	constructor(site: Site) {
		this.site = site;
	}

	/**
	 * @returns UTF16 string representing document
	 */
	text(): string {
		// [].join("") is slower
		// https://stackoverflow.com/questions/16696632/most-efficient-way-to-concatenate-strings-in-javascript
		let text = "";
		for (const insert of this.inserts)
			if (!this.#isDeleted(insert.id)) text += insert.content;
		return text;
	}

	/** Insert UTF16 `content` at code unit `textIndex`. */
	insert(textIndex: number, content: string) {
		if (!content) return; // empty string

		const { insertIndex, offset } = this.#textIndexToInsertIndex(textIndex);
		const clock = (this.version[this.site] ?? -1) + 1;
		const newInsert: Insert = {
			id: { site: this.site, clock },
			parent: null,
			counter: 0,
			content,
		};

		if (offset > 0) {
			// Increment the counter of the split insert so we come before the tail
			// of the split
			const insertToSplit = this.inserts[insertIndex];
			newInsert.parent = {
				site: insertToSplit.id.site,
				clock: insertToSplit.id.clock + offset - 1,
			};
			newInsert.counter = insertToSplit.counter + 1;
		} else {
			if (insertIndex > 0) {
				// Copy the counter before us to allow us to merge with it
				const insertBefore = this.inserts[insertIndex - 1];
				newInsert.parent = {
					site: insertBefore.id.site,
					clock: lastClock(insertBefore),
				};
				newInsert.counter = insertBefore.counter;
			}
			if (insertIndex < this.inserts.length) {
				// Make sure we come before the insert after us if it conflicts with us
				const insertAfter = this.inserts[insertIndex];
				if (
					isSameIdentifier(newInsert.parent, insertAfter.parent) &&
					!childrenWithSameParentAreInOrder(newInsert, insertAfter)
				) {
					newInsert.counter = insertAfter.counter + 1;
				}
			}
		}

		this.#integrateInsert(newInsert);
	}

	/** Delete `textLength` UTF16 code units at code unit `textStart`. */
	delete(textStart: number, textLength: number) {
		if (textLength < 1) return; // Do nothing for an empty delete

		let { insertIndex, offset } = this.#textIndexToInsertIndex(textStart);
		let clock = (this.version[this.site] ?? -1) + 1;
		const deletes: Delete[] = [];

		for (
			const textEnd = textStart + textLength;
			textStart < textEnd;
			insertIndex++, offset = 0
		) {
			const insert = this.inserts[insertIndex];
			if (this.#isDeleted(insert.id)) continue;

			deletes.push({
				id: {
					site: insert.id.site,
					clock: insert.id.clock + offset,
				},
				version: { [this.site]: clock++ },
				end: Math.min(
					insert.id.clock + offset + textEnd - textStart,
					lastClock(insert) + 1,
				),
			});
			textStart += insert.content.length - offset;
		}

		for (const del of deletes) this.#integrateDelete(del);
	}

	/**
	 * Generate a patch to send to other sites.
	 *
	 * @param version The latest known state vector for the target site. Mutated
	 * to be the new vector after  this patch.
	 * @returns Changes `version` is missing.
	 */
	generatePatch(version: StateVector): string | null {
		const { inserts, deletes } = filterChanges(
			version,
			this.inserts,
			this.deletes,
		);
		for (const insert of inserts)
			includeInVersion(version, insert.id.site, lastClock(insert));
		for (const del of deletes)
			for (const site in del.version)
				includeInVersion(version, site, del.version[site]);
		return inserts.length || deletes.length
			? JSON.stringify({ inserts, deletes })
			: null;
	}

	/**
	 * Applies a patch from another site.
	 *
	 * @param patch The patch to apply, sent to us by another site
	 * @param  version The latest known version for that other site. Mutated to be
	 * the be the new vector after this patch.
	 */
	applyPatch(patch: string, version: StateVector): void {
		const json: { inserts: Insert[]; deletes: Delete[] } = JSON.parse(patch);
		const { inserts, deletes } = filterChanges(
			this.version,
			json.inserts,
			json.deletes,
		);

		// We need to apply incoming inserts in a certain order for correctness. To
		// maintain our tree invariants, parents must be applied before children.
		// And to be able to split inserts that we already have part of, inserts
		// from the same site must be applied in increasing clock order. Instead of
		// sorting the inserts so that parents come before children, we instead
		// apply incoming inserts using multiple passes.
		//
		// Deletes must be applied after inserts so that they don't affect the
		// clock values used for partially-applied insert checks and because
		// splitting existing inserts when integrating a delete is implemented but
		// splitting an integrated insert by existing deletes is NOT implemented.

		// Apply new inserts in increasing clock order.
		inserts.sort((a, b) => a.id.clock - b.id.clock);

		// Apply new inserts such that parents come before children
		while (inserts.length) {
			let lengthAfterFilter = 0;
			for (const insert of inserts) {
				if (
					insert.parent !== null &&
					(this.version[insert.parent.site] ?? -1) < insert.parent.clock
				) {
					// Parent not integrated yet, insert later
					inserts[lengthAfterFilter++] = insert;
				} else {
					includeInVersion(version, insert.id.site, lastClock(insert));
					this.#integrateInsert(insert);
				}
			}
			if (lengthAfterFilter === inserts.length)
				throw "Detected an infinite loop";
			inserts.length = lengthAfterFilter;
		}

		// Apply new deletes in an arbitrary order
		for (const del of deletes) {
			for (const site in del.version)
				includeInVersion(version, site, del.version[site]);
			this.#integrateDelete(del);
		}
	}

	/**
	 * Maps from an index of a UTF16 code unit in the string this document currently
	 * represents into an index of an insert in this document's internal store.
	 * Since each insert may represent multiple UTF16 code units, the returned offset
	 * will be non-zero if the index points inside of an insert (which means the
	 * insert needs to be split).
	 */
	#textIndexToInsertIndex(textIndex: number): {
		insertIndex: number;
		offset: number;
	} {
		for (let i = 0; i < this.inserts.length; i++) {
			const insert = this.inserts[i];
			if (this.#isDeleted(insert.id)) continue;
			if (textIndex < insert.content.length)
				return { insertIndex: i, offset: textIndex };
			textIndex -= insert.content.length;
		}
		return { insertIndex: this.inserts.length, offset: 0 };
	}

	/**
	 * Integrate a new insert into this document's insert storage. Makes sure to
	 * put it in the correct place and to also uphold any relevant invariants.
	 *
	 * @param newInsert May be mutated.
	 */
	#integrateInsert(newInsert: Insert) {
		includeInVersion(this.version, newInsert.id.site, lastClock(newInsert));

		// Potentially split the parent insert if our parent is in the middle
		let indexOfFirstChild = 0;
		if (newInsert.parent !== null) {
			const id = newInsert.parent;
			const insertIndex = this.inserts.findIndex(
				(insert) =>
					insert.id.site === id.site &&
					id.clock >= insert.id.clock &&
					id.clock <= lastClock(insert),
			);
			this.#splitInsertIfNecessary(
				insertIndex,
				id.clock - this.inserts[insertIndex].id.clock + 1,
			);
			indexOfFirstChild = insertIndex + 1;
		}

		// Splice at the correct index within this parent's children
		const spliceIndex = this.#findSpliceIndex(indexOfFirstChild, newInsert);
		this.inserts.splice(spliceIndex, 0, newInsert);
		this.#tryToMergeInsertWithPrevious(spliceIndex);
	}

	/**
	 * If the given offset lies in the middle of the referenced insert, split
	 * that insert at the given offset.
	 */
	#splitInsertIfNecessary(insertIndex: number, offset: number): boolean {
		if (offset <= 0) return false;

		const insert = this.inserts[insertIndex];
		if (insert.id.clock + offset > lastClock(insert)) return false;

		this.inserts.splice(
			insertIndex + 1,
			0,
			remainingInsertAfterClock(insert, insert.id.clock + offset - 1),
		);
		insert.content = insert.content.slice(0, offset);

		return true;
	}

	/**
	 * If the given insert can be merged with the insert before it, merge the
	 * insert. This is only done if the merged insert would be equivalent to the
	 * original two unmerged inserts.
	 */
	#tryToMergeInsertWithPrevious(i: number): boolean {
		if (i > 0) {
			// Validate the insert
			const insert = this.inserts[i];
			if (
				insert.parent !== null &&
				insert.id.site === insert.parent.site &&
				insert.id.clock === insert.parent.clock + 1
			) {
				// Validate the insert before
				const insertBefore = this.inserts[i - 1];
				if (
					insert.id.site === insertBefore.id.site &&
					insert.id.clock === lastClock(insertBefore) + 1 &&
					insert.counter === insertBefore.counter &&
					this.#isDeleted(insert.id) === this.#isDeleted(insertBefore.id)
				) {
					// Validate the insert after
					const insertAfter =
						i + 1 < this.inserts.length ? this.inserts[i + 1] : null;
					if (
						insertAfter === null ||
						!isSameIdentifier(insert.parent, insertAfter.parent) ||
						!childrenWithSameParentAreInOrder(insert, insertAfter)
					) {
						insertBefore.content += insert.content;
						this.inserts.splice(i, 1);
						return true;
					}
				}
			}
		}

		return false;
	}

	/**
	 * This determines the index to insert the new insert at that maintains the
	 * following invariants:
	 *
	 *   1. Children are always sorted after parents
	 *   2. Children with greater clocks come first
	 *   3. Children with equal clocks but greater sites come first
	 *
	 * @param index The index immediately after the new insert's parent
	 */
	#findSpliceIndex(index: number, newInsert: Insert): number {
		const haveSeen = new Set<string>();
		const newParentKey =
			newInsert.parent && `${newInsert.parent.site} ${newInsert.parent.clock}`;

		for (; index < this.inserts.length; index++) {
			const insert = this.inserts[index];
			const parentKey =
				insert.parent && `${insert.parent.site} ${insert.parent.clock}`;
			if (parentKey === newParentKey) {
				// Stop if we come before this sibling
				if (childrenWithSameParentAreInOrder(newInsert, insert)) break;
			} else {
				// Stop if we left our parent's subtree
				if (parentKey === null || !haveSeen.has(parentKey)) break;
			}
			// Add the clock for the end of this insert
			haveSeen.add(`${insert.id.site} ${lastClock(insert)}`);
		}

		return index;
	}

	/**
	 * Returns true if the given identifier has been marked as deleted. Deletes
	 * are permanent but are kept around (called "tombstones") so that we are
	 * still able to determine the order of incoming changes from other sites
	 * that may have used those deleted inserts as parents.
	 */
	#isDeleted(id: Identifier): boolean {
		return this.deletes.some(
			({ id: { site, clock }, end }) =>
				id.site === site && id.clock >= clock && id.clock < end,
		);
	}

	/**
	 * Integrate the changes represented by the given delete into the internal
	 * ranged delete set representation.
	 *
	 * @param newDelete May be mutated.
	 */
	#integrateDelete(newDelete: Delete) {
		for (const site in newDelete.version)
			includeInVersion(this.version, site, newDelete.version[site]);

		// Merge deletes from the same site together if they touch and/or overlap
		let lengthAfterFilter = 0;
		for (const oldDelete of this.deletes) {
			if (
				oldDelete.id.site === newDelete.id.site &&
				oldDelete.end >= newDelete.id.clock &&
				newDelete.end >= oldDelete.id.clock
			) {
				for (const site in oldDelete.version)
					newDelete.version[site] = Math.max(
						newDelete.version[site] ?? -1,
						oldDelete.version[site],
					);
				newDelete.id.clock = Math.min(newDelete.id.clock, oldDelete.id.clock);
				newDelete.end = Math.max(newDelete.end, oldDelete.end);
			} else {
				this.deletes[lengthAfterFilter++] = oldDelete;
			}
		}
		this.deletes.length = lengthAfterFilter;
		this.deletes.push(newDelete);

		// Split overlapping inserts as necessary
		for (let i = 0; i < this.inserts.length; i++) {
			const insert = this.inserts[i];
			// Skip inserts from other sites
			if (insert.id.site !== newDelete.id.site) continue;
			const start = insert.id.clock;
			const end = lastClock(insert) + 1;
			// Skip if it doesn't overlap
			if (end <= newDelete.id.clock || start >= newDelete.end) continue;
			// Split at the start
			if (this.#splitInsertIfNecessary(i, newDelete.id.clock - start)) i++;
			if (
				this.#splitInsertIfNecessary(
					i,
					newDelete.end - this.inserts[i].id.clock,
				)
			)
				i++; // Split at the end
		}

		// Merge touching inserts as necessary
		for (let i = 0; i < this.inserts.length; i++) {
			const insert = this.inserts[i];
			// Skip inserts from other sites
			if (insert.id.site !== newDelete.id.site) continue;
			const start = insert.id.clock;
			const end = lastClock(insert) + 1;
			// Skip if it doesn't touch
			if (end < newDelete.id.clock || start > newDelete.end) continue;
			if (this.#tryToMergeInsertWithPrevious(i)) i--;
		}
	}
}

/**
 * When two inserts have the same parent, the one with the greatest counter
 * comes first. If they have the same counter, the one with the greatest site
 * comes first. This order is unique because no single site will generate the
 * same counter twice for the same parent.
 *
 * We must order the greater counter first because we increment the counter to
 * insert before a conflicting UTF16 code unit. The site ordering is arbitrary as
 * long as it's consistent. Site ordering only matters for concurrent inserts
 * in the same location.
 */
function childrenWithSameParentAreInOrder(
	before: Insert,
	after: Insert,
): boolean {
	return (
		before.counter > after.counter ||
		(before.counter === after.counter && before.id.site < after.id.site)
	);
}

/**
 * An insert always represents at least one clock value, but may represent
 * multiple clock values if multiple inserts have been merged together.
 */
function lastClock(insert: Insert): number {
	return insert.id.clock + insert.content.length - 1;
}

/**
 * Invariant: The state vector always has the latest known clock value for each
 * given site.
 */
function includeInVersion(version: StateVector, site: Site, clock: number) {
	version[site] = Math.max(version[site] ?? -1, clock);
}

function isSameIdentifier(a: Identifier | null, b: Identifier | null): boolean {
	return a?.site === b?.site && a?.clock === b?.clock;
}

/**
 * In certain editing scenarios, we can be sent a change that we already have a
 * part of. Consider the following:
 *
 *   1. Site A inserts "x" and sends a patch with "x" to sites B and C
 *   2. Site A inserts "y" and sends a patch with "y" to site B
 *   3. Site B sends a patch with "xy" to site C
 *
 * Site B doesn't know that site C has "x" already because site C hasn't sent
 * anything to site B yet (possibly due to network lag), so site B sends both
 * "x" and "y". But site C already has "x" so it has to apply the remainder of
 * the change "xy" that it doesn't have, which is "y".
 */
function remainingInsertAfterClock(insert: Insert, clock: number): Insert {
	return {
		id: { site: insert.id.site, clock: clock + 1 },
		parent: { site: insert.id.site, clock },
		counter: insert.counter,
		content: insert.content.slice(clock + 1 - insert.id.clock),
	};
}

/**
 * Returns all inserts and deletes that are not part of the given version. This
 * may involve removing the leading part of an insert if the given version
 * already has the leading part.
 */
function filterChanges(
	version: StateVector,
	allInserts: Insert[],
	allDeletes: Delete[],
): { inserts: Insert[]; deletes: Delete[] } {
	const inserts: Insert[] = [];
	const deletes: Delete[] = [];

	// Filter inserts
	for (let insert of allInserts) {
		const clock = version[insert.id.site] ?? -1;
		if (clock >= lastClock(insert)) continue; // Already have all of it
		if (clock >= insert.id.clock)
			insert = remainingInsertAfterClock(insert, clock); // Already have part of it
		inserts.push(insert);
	}

	// Filter deletes
	for (const del of allDeletes) {
		for (const site in del.version) {
			if ((version[site] ?? -1) >= del.version[site]) continue; // Already have it
			deletes.push(del);
			break;
		}
	}

	return { inserts, deletes };
}

import { do_not_optimize } from "mitata";
import { benchLib, type Splice } from "./harness";

export default function run() {
	benchLib("naive", (arr: Splice[]) => {
		const doc = new Doc("agent1");

		for (const splice of arr) {
			if (splice.delCount) {
				doc.delete(splice.pos, splice.delCount);
			}

			doc.insert(splice.pos, splice.text);
		}

		return do_not_optimize(doc);
	});
}
