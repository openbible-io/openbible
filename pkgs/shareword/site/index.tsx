import { render } from "preact";
import { Doc } from "../src/index";
import Editor from "./editor";

const user1 = "bob";
const user2 = "alice";
const doc1 = new Doc(user1);
const doc2 = new Doc(user2);
doc1.insert(`hello im ${user1}`);
doc2.insert(`hello im ${user2}`);
window.doc1 = doc1;
window.doc2 = doc2;

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
						doc1.reset();
						doc2.reset();
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
