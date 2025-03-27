import { render } from "preact";
import { useEffect, useState } from "preact/hooks"
import { Text, type Site } from "@openbible/shareword";
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

function initText(site: Site) {
	const res = new Text(site);
	res.insert(0, `hello im ${site}`);
	// @ts-ignore
	if (typeof window !== "undefined") window[site] = res;

	return res;
}

function App() {
	const [doc1, setDoc1] = useState(initText(user1));
	const [doc2, setDoc2] = useState(initText(user2));

	return (
		<>
			<div class="flex h-[80vh]">
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
						setDoc1(new Text(doc1.site));
						setDoc2(new Text(doc2.site));
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
