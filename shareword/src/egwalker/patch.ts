import { MultiArrayList } from "./util/multi-array-list";
import type { Accumulator, Clock, SiteOpLog } from "./oplog-site";
import type { OpId, Site } from "./oplog";
import type { Rle } from "./util";

type SiteLogParents<T, AccT extends Accumulator<T>> = {
	[site: Site]: {
		log: SiteOpLog<T, AccT>;
		parents: Rle<OpId, MultiArrayList<OpId>>;
	}
};

/**
 * A diff between two RleOpLogs.
 *
 * It's really just a modified RleOpLog:
 * - Parents are OpId[] instead of Clock[] so the for reparenting.
 * - Remove `frontier`.
 * - Add serialization/deserialization to bytes.
 */
export class Patch<T, AccT extends Accumulator<T>> {
	siteLogs: SiteLogParents<T, AccT> = {};
}
