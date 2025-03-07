import { render } from "preact";
// @ts-ignore: our bundler doesn't care about tsc "rootDir"
import { Text } from "../../src/index";
import { languageSplices } from "../../bench/languageSplices";
import Editor from "./editor";

let acc = 0;
const text = new Text("a");
for (const splice of languageSplices.en.slice(0, 10000)) {
	if (splice.delCount) {
		text.delete(splice.pos, splice.delCount);
	}

	text.insert(splice.pos, splice.text);
}
const res = text.toString();
acc += res.length;
console.log(acc);

//const user1 = "bob";
//const user2 = "alice";
//const doc1 = new Doc(user1);
//const doc2 = new Doc(user2);
//for (let i = 0; i < 10_000; i++) {
//	doc1.insert(0, `hello im ${user1}`);
//	doc2.insert(0, `hello im ${user2}`);
//}
//console.log(doc1.toString().length, doc2.toString().length)
//window.doc1 = doc1;
//window.doc2 = doc2;
//
//function App() {
//	return (
//		<>
//			<div class="flex  h-[80vh]">
//				<Editor class="w-1/2 h-full" doc={doc1} />
//				<Editor class="w-1/2 h-full" doc={doc2} />
//			</div>
//			<div class="flex flex-col">
//				<button type="button" onClick={() => doc1.merge(doc2)}>
//					{"<-"}
//				</button>
//				<button type="button" onClick={() => doc2.merge(doc1)}>
//					{"->"}
//				</button>
//				<button
//					type="reset"
//					onClick={() => {
//						doc1.reset();
//						doc2.reset();
//					}}
//				>
//					Reset
//				</button>
//			</div>
//		</>
//	);
//}
//
//const root = document.getElementById("root");
//if (root) render(<App />, root);
