import { render } from "preact";
import { Text } from "@openbible/shareword";
import Editor from "./editor";

// @ts-ignore
import.meta.hot.accept();

//async function bench() {
//	const { languageSplices } = await import("@openbible/shareword/bench/languageSplices");
//	let acc = 0;
//	const text = new Text("a");
//	// biome-ignore lint/complexity/useLiteralKeys: <explanation>
//	for (const splice of languageSplices["en"].slice(0, 10000)) {
//		if (splice.delCount) {
//			text.delete(splice.pos, splice.delCount);
//		}
//
//		text.insert(splice.pos, splice.text);
//	}
//	const res = text.toString();
//	acc += res.length;
//	console.log(acc);
//}

const user1 = "bob";
const user2 = "alice";
let doc1 = new Text(user1);
let doc2 = new Text(user2);
doc1.insert(0, `hello im ${user1}`);
doc2.insert(0, `hello im ${user2}`);
console.log(doc1.toString().length, doc2.toString().length)
if (typeof window !== "undefined") {
	// @ts-ignore
	window.doc1 = doc1;
	// @ts-ignore
	window.doc2 = doc2;
}

function App() {
	return (
		<>
			<div class="flex  h-[80vh]">
				<Editor class="w-1/2 h-full" doc={doc1} />
				<Editor class="w-1/2 h-full" doc={doc2} />
			</div>
			<div class="flex flex-col">
				<button type="button" onClick={() => doc1.merge(doc2)}>
					{"<-"}
				</button>
				<button type="button" onClick={() => doc2.merge(doc1)}>
					{"->"}
				</button>
				<button
					type="reset"
					onClick={() => {
						doc1 = new Text(doc1.site);
						doc2 = new Text(doc2.site);
					}}
				>
					Reset
				</button>
			</div>
		</>
	);
}

const root = document.getElementById("root");
if (root) render(<App />, root);
