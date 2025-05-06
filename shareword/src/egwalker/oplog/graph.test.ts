import { test, expect } from "bun:test";
import { Oplog as Graph, toDot } from "./graph";

test("convergence with parent splitting", () => {
	const mergeFn = (a: string, b: string) => a + b;
	const g1 = new Graph(mergeFn);
	//g1.apply("abc", -1, "C");
	g1.insert("a", 0, "a");
	g1.insert("b", 1, "b");
	g1.insert("a", 2, "cd");
	g1.delete("a", 4, -1);
	// g1.insert("b", 2, "c", [{ replica: "b", clock: 1 }]);
	console.dir(g1, { depth: null })
	console.log(toDot(g1));

	// const g2 = new Graph(mergeFn);
	// g2.insert("a", 0, "a");
	// g2.insert("b", 1, "bc");
	// g2.insert("a", 2, "cd", [{ replica: "b", clock: 1 }]);
	//console.log(toDot(g2));

	//expect(g1.nodes).toEqual(g2.nodes);
});
