import { useEffect, useRef } from "preact/hooks";
import type { Text as Doc } from "@openbible/shareword";
import { HtmlSnapshot } from "../../shareword/src/egwalker/snapshot";

function claz(...names: (string | undefined | null)[]): string {
	return names.filter(Boolean).join(" ");
}

export default function Editor(props: { class?: string; doc: Doc }) {
	const { doc } = props;
	const ref = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (ref.current) {
			ref.current.innerText = doc.toString();
			doc.snapshot = new HtmlSnapshot(ref.current.childNodes[0]);
		}
	}, [doc]);

	function onBeforeInput(ev: InputEvent) {
		const data = ev.data ?? "";

		switch (ev.inputType) {
			case "insertText":
				for (const range of ev.getTargetRanges()) {
					doc.delete(
						range.startOffset,
						range.endOffset - range.startOffset,
						false,
					);
					doc.insert(range.startOffset, data, false);
				}
				break;
			case "deleteContentBackward":
			case "deleteWordBackward":
			case "deleteContentForward":
			case "deleteWordForward":
				for (const range of ev.getTargetRanges()) {
					doc.delete(
						range.startOffset,
						range.endOffset - range.startOffset,
						false,
					);
				}
				break;
			case "insertParagraph":
				for (const range of ev.getTargetRanges()) {
					doc.delete(
						range.startOffset,
						range.endOffset - range.startOffset,
					);
					console.log("insertParagraph", range.startOffset, range.endOffset);
					doc.insert(range.startOffset, "\n\n");

					document.getSelection()?.modify("move", "forward", "character");
				}
				ev.preventDefault(); // don't want a div
				break;
			//case "insertFromPaste":
			default:
				// There's a bunch of deprecated inconsistent events.
				// https://w3c.github.io/input-events/#interface-InputEvent-Attributes
				console.log("ignoring", ev.inputType);
				ev.preventDefault();
				break;
		}
		ref.current?.normalize();
	}

	return (
		<div
			contenteditable
			class={claz(props.class, "p-1 border-sky-500 border whitespace-pre-wrap")}
			spellcheck={false}
			onBeforeInput={onBeforeInput}
			ref={ref}
		/>
	);
}
