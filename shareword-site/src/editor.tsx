import { useRef } from "preact/hooks";
import type { Text as Doc } from "../../src/text";

function claz(...names: (string | undefined | null)[]): string {
	return names.filter(Boolean).join(" ");
}

export default function Editor(props: { class?: string; doc: Doc }) {
	const { doc } = props;
	const ref = useRef<HTMLDivElement | null>(null);

	//useEffect(() => {
	//	// TODO: proper diff + apply
	//	function onChange2() {
	//		if (ref.current) ref.current.innerText = doc.toString();
	//	}
	//	doc.addEventListener("change", onChange2);
	//	return () => doc.removeEventListener("change", onChange2);
	//}, [doc]);

	function onInput(ev: InputEvent) {
		console.log(ev.inputType);
		switch (ev.inputType) {
			case "insertText":
				doc.insert(ev.data ?? "");
				console.log(document.getSelection());
				break;
			case "deleteContentBackward":
				doc.delete(-1);
				break;
			case "deleteContentForward":
				doc.delete(1);
				break;
		}
	}

	function onBeforeInput(ev: InputEvent) {
		switch (ev.inputType) {
			case "insertText":
			case "deleteContentBackward":
			case "deleteContentForward":
			//case "deleteWordBackward":
			//case "deleteWordForward":
				break;
			default:
				// There's a bunch of deprecated inconsistent events.
				// https://w3c.github.io/input-events/#interface-InputEvent-Attributes
				console.log("ignoring", ev.inputType);
				ev.preventDefault();
				break;
		}
	}

	return (
		<div
			contenteditable="plaintext-only"
			class={claz(props.class, "border-sky-500 border")}
			ref={ref}
			spellcheck={false}
			onBeforeInput={onBeforeInput}
			onInput={onInput}
		>
			{doc.toString()}
		</div>
	);
}
