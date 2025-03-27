import { render } from "preact";
import { useState } from "preact/hooks";
import { Text as Doc, type Site } from "@openbible/shareword";
import Editor from "./editor";
import EditorDebug from "./editor-debug";
import Button from "./button";

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

function initText(site: Site) {
	const res = new Doc(site);
	res.insert(0, `hello, im ${site}\n`);
	// @ts-ignore
	if (typeof window !== "undefined") window[site] = res;

	return res;
}

function App() {
	const [doc1, setDoc1] = useState(initText("bob"));
	const [doc2, setDoc2] = useState(initText("alice"));

	return (
		<>
			<Editor doc={doc1} />
			<div class="flex flex-col justify-center gap-1">
				<Button onClick={() => doc1.merge(doc2)}>←</Button>
				<Button onClick={() => doc2.merge(doc1)}>→</Button>
				<Button
					type="reset"
					onClick={() => {
						setDoc1(new Doc(doc1.site));
						setDoc2(new Doc(doc2.site));
					}}
				>
					Reset
				</Button>
			</div>
			<Editor doc={doc2} />
			<EditorDebug doc={doc1} />
			<div />
			<EditorDebug doc={doc2} />
		</>
	);
}

render(<App />, document.body);
