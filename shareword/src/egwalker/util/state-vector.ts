/** A collaborating agent */
export type Site = string;
/**
 * Lamport timestamp.
 * Non-negative integer incremented after each operation.
 */
export type Clock = number;

export type StateVectorDiff = Record<Site, /* First missing */ Clock>;

/** Max known clock for each site. */
export default class StateVector {
	clocks: Record<Site, Clock> = {};

	diff(other: StateVector): StateVectorDiff {
		const res: StateVectorDiff = {};

		for (const [site, maxClock] of Object.entries(this.clocks)) {
			if (site in other.clocks) {
				if (maxClock > other.clocks[site]) res[site] = other.clocks[site] + 1;
			} else {
				// missing everything
				res[site] = 0;
			}
		}

		return res;
	}
}
