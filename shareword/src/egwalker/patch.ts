import { opLength, opSlice, type Accumulator, type Clock, type OpData, type Site } from "./op";
import { advanceFrontier, type OpLog } from "./oplog";
import { ListMap, MultiArrayList } from "./util";

/** Max stored `clock` for each site. */
export type StateVector = Record<Site, number>;

type PatchParents = Record<number, [site: number, clock: Clock][]>;
export class Patch<T, AccT extends Accumulator<T>> {
	ops: MultiArrayList<{
		site: number;
		clock: Clock;
		position: number;
		data: OpData<T, AccT>;
		parents: PatchParents;
	}>;
	sites: Site[] = [];

	constructor(emptyItem: AccT, oplog: OpLog<T, AccT>, to: StateVector) {
		this.ops = new MultiArrayList({
			site: 0,
			clock: 0,
			position: 0,
			data: emptyItem,
			parents: {},
		});
		const sites = new ListMap<Site>();

		// 1. State vector diff
		const missing: Record<Site, Clock> = {};
		// This optimization is good enough because the missing items
		// are usually continuous.
		let minI = Number.POSITIVE_INFINITY;
		for (const [site, idxs] of Object.entries(oplog.siteIdxs)) {
			// biome-ignore lint/style/noNonNullAssertion: clocks.length > 0
			const idx = idxs.at(-1)!;
			const maxClock = oplog.items.fields.clock[idx] + oplog.len(idx) - 1;
			if (site in to) {
				if (maxClock > to[site]) {
					missing[site] = to[site] + 1;
					minI = Math.min(minI, oplog.idToIndex(site, missing[site]));
				}
			} else {
				// missing everything
				missing[site] = 0;
				minI = Math.min(minI, oplog.idToIndex(site, missing[site]));
			}
		}

		// 2. Scan RLE items
		let lastParent = -2;
		for (let i = minI; i < oplog.items.length; i++) {
			const site = oplog.getSiteRaw(i);
			const clock = oplog.getClockRaw(i, 0);
			const len = oplog.len(i);
			if (!(site in missing) || clock + len <= missing[site]) continue;

			const offset = clock < missing[site] ? missing[site] - clock : 0;
			const start = oplog.starts[i];
			const deleted = oplog.getDeletedRaw(i);
			const parents: PatchParents = {};
			for (let j = offset; j < len; j++) {
				const thisParents =
					j === offset && lastParent + 1 !== i + j
						? oplog.getParents(start + j) // might not be in other oplog's run
						: oplog.parents[start + j];
				if (thisParents) {
					parents[j - offset] = thisParents.map((p) => {
						const { idx, offset } = oplog.offsetOf(p);
						const site = sites.getOrPut(oplog.getSiteRaw(idx));
						const clock = oplog.getClockRaw(idx, offset);

						return [site, clock];
					});
					lastParent = i + j;
				}
			}

			this.ops.push({
				site: sites.getOrPut(site),
				clock: oplog.getClockRaw(i, offset),
				position: oplog.getPosRaw(i, offset, deleted),
				data: opSlice(oplog.getItemRaw(i), offset),
				parents,
			});
		}

		this.sites = sites.keys;
	}

	apply(oplog: OpLog<T, AccT>): void {
		const toClock = (site: Site, clock: Clock): Clock => {
			const idx = oplog.idToIndex(site, clock);
			return oplog.starts[idx] - oplog.getClockRaw(idx, -clock);
		};

		const { fields } = this.ops;
		for (let i = 0; i < this.ops.length; i++) {
			const site = this.sites[fields.site[i]];
			const clock = fields.clock[i];
			const data = fields.data[i];
			const len = opLength(data);

			oplog.push(
				{
					site: oplog.sites.getOrPut(site),
					clock,
					position: fields.position[i],
					data
				},
				len
			);
			oplog.advanceClock(site);
			for (const [j, parents] of Object.entries(fields.parents[i])) {
				oplog.parents[oplog.length - len + +j] = parents
					.map((id) => toClock(this.sites[id[0]], id[1]))
					.sort((a, b) => a - b);
			}
			for (let j = 0; j < len; j++) {
				const nextClock = oplog.length - len + j;
				oplog.frontier = advanceFrontier(
					oplog.frontier,
					nextClock,
					oplog.getParents(nextClock),
				);
			}
		}
	}
}
