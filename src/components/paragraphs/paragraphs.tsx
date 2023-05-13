import { h, Fragment } from 'preact'
import { Paragraph } from './paragraph'
import { ParagraphType, VerseType } from '../../utils/books'

interface ParagraphsProps {
	paragraphs?: (ParagraphType | VerseType)[];
}

export function Paragraphs(props: ParagraphsProps) {
	if (!props.paragraphs) {
		return <div>Loading</div>
	}
	return (
		<Fragment>
			{props.paragraphs.map(p =>
				<Paragraph paragraph={p} />
			)}
		</Fragment>
	)
}
