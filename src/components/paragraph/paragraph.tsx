import { h } from 'preact'
import { ParagraphType } from '../../utils/books'
import { Verse } from '../verse/verse';
import styles from './paragraph.css'

function getClass(tag: string) {
	if (tag == "qa") return styles.qa;
	if (tag.startsWith("q")) return styles.q;
	if (tag.startsWith("br")) return styles.p;

	return undefined;
}

export function Paragraph(props: ParagraphType) {
	if (!Array.isArray(props.verses)) return <div>Expected verses array</div>;

	return (
		<p class={getClass(props.tag)} data-kind={props.tag}>
			{props.verses.map(Verse)}
		</p>
	);
}

export function Paragraphs(props: ParagraphType[]) {
	if (!Array.isArray(props)) return <div>Expected paragraphs array</div>;

	return props.map(Paragraph);
}
