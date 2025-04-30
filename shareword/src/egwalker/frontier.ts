export class Frontier<T> extends Array<T> {
	advance(parents: T[], ref: T): void {
		let j = 0;

		this.forEach((e, i) => {
			if (!parents.includes(e)) {
				if (i !== j) this[j] = e;
				j++;
			}
		});

		this.length = j;
		this.push(ref);
	}
}
