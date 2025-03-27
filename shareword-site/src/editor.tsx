import { useEffect, useMemo } from "preact/hooks";
import type { Text as Doc } from "@openbible/shareword";
import { HtmlSnapshot } from "../../shareword/src/egwalker/snapshot";
import { createRef } from "preact";

function claz(...names: (string | undefined | null)[]): string {
	return names.filter(Boolean).join(" ");
}

export default function Editor(props: { class?: string; doc: Doc }) {
	const { doc } = props;
	const ref = createRef<HTMLDivElement>();
	const text = useMemo(() => new Text(), []);

	useEffect(() => {
		text.data = doc.toString();
		doc.snapshot = new HtmlSnapshot(text);
		ref.current?.append(text);
	}, [text, doc, ref]);

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
					doc.insert(range.startOffset, "\n");

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
