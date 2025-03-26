import { useRef, useEffect } from "preact/hooks";
import type { Text as Doc } from "@openbible/shareword";

function claz(...names: (string | undefined | null)[]): string {
	return names.filter(Boolean).join(" ");
}

export default function Editor(props: { class?: string; doc: Doc }) {
	const { doc } = props;
	const ref = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		// TODO: proper diff + apply
		function onChange2() {
			if (ref.current) ref.current.innerText = doc.toString();
		}
		doc.addEventListener("merge", onChange2);
		return () => doc.removeEventListener("merge", onChange2);
	}, [doc]);

	function onBeforeInput(ev: InputEvent) {
		console.log(ev.inputType);
		switch (ev.inputType) {
			case "insertText":
				for (const range of ev.getTargetRanges()) {
					doc.insert(range.startOffset, ev.data ?? "");
				}
				break;
			case "deleteContentBackward":
			case "deleteContentForward":
			case "deleteWordBackward":
			case "deleteWordForward":
				for (const range of ev.getTargetRanges()) {
					doc.delete(range.startOffset, range.endOffset - range.startOffset);
				}
				break;
				//case "insertFromPaste":
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
			contenteditable
			class={claz(props.class, "border-sky-500 border")}
			ref={ref}
			spellcheck={false}
			onBeforeInput={onBeforeInput}
		>
			{doc.toString()}
		</div>
	);
}
