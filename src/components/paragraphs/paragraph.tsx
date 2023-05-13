import { h, Fragment } from 'preact'
import { ParagraphType, VerseType } from '../../utils/books'
import { Paragraphs } from './paragraphs'
import { Verse } from './verse'
import styles from './paragraph.css'

export function getParagraphClass(paragraph?: ParagraphType) {
	if (!paragraph) {
		return ''
	}
	else if (paragraph.t === 'q' && paragraph.v[0].t === 'v') {
		return styles.qcol
	}

	return styles[paragraph.t]
}

interface ParagraphProps {
	paragraph: ParagraphType | VerseType;
}

export function Paragraph(props: ParagraphProps) {
	const paragraph = props.paragraph

	if (Array.isArray(paragraph.v)) {
		const className = getParagraphClass(paragraph as ParagraphType)
		return (
			<p data-id={paragraph.id} class={className}>
				<Paragraphs paragraphs={paragraph.v} />
			</p>
		)
	}

	return <Verse verse={paragraph} />
}
