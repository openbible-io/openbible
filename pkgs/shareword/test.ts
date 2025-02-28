import { List, Order, type Position } from "list-positions";

const order = new Order({ replicaID: "replica1" });
const list = new List(order);

let p: Position = list.cursorAt(0);
[p] = list.insert(p, "a");
[p] = list.insert(p, "b");
[p] = list.insert(p, "c");
//list.delete(p);
//[p] = list.insert(p, "d");
//list.setAt(0, "A");
//list.deleteAt(1);

//list.set(newPos, "Z");
//list.delete(newPos);
//
//
//const [otherPos] = list.order.createPositions(MIN_POSITION, list.positionAt(0), 1);
//list.set(otherPos, "w");

console.log([...list.values()]);
console.log(list.save())
console.log(list.order.save());

