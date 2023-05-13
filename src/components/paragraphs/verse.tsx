import { h, Fragment } from 'preact'
import { classnames } from '../../utils/classnames'
import { onDoubleClickVerseNumber } from './select'
import styles from './verse.css'
import highlightStyles from './highlights.css'
import { VerseType } from '../../utils/books'
import { VerseNote } from './versenote'

let lastVerse: VerseType
const startPunct = /['"“‘\[\(\-]/
const endPunct = /['".”’,?!:;\]\)\-]/
const suffixes = [
	's', // Possesion like "Pharaoh’s"
	'th', // Number like "480th year"
]

interface VerseProps {
	verse: VerseType;
}

const isNoted = (verse: VerseType) => Boolean(verse.noted) || verse.noted === 0

export function Verse(props: VerseProps) {
	const verse = props.verse
	const style = verse.highlight
		? { background: verse.highlight } as { background: string }
		: {}
	let prependSpace = verse.t === 'w' || verse.t === 't' 
	if (lastVerse && (
				lastVerse.n
				|| startPunct.test(lastVerse.v as string)
				|| endPunct.test(verse.v as string)
				|| suffixes.includes(verse.v as string)
		)) {
		prependSpace = false
	}
	const res = (
		<Fragment>
			{prependSpace &&
				<span
					class={classnames(
						lastVerse && isNoted(lastVerse) && isNoted(verse) && styles.noted
					)}
					style={style}
				>
					{' '}
				</span>
			}
			{verse.n &&
				<sup
					onDblClick={onDoubleClickVerseNumber}
					class={classnames(
						styles.sup,
					)}
					style={style}
				>
					{verse.n}
				</sup>
			}
			{verse.v &&
				<span
					data-id={verse.id}
					class={classnames(
						styles[verse.t],
						isNoted(verse) && styles.noted
					)}
					style={style}
				>
					{verse.v}
				</span>
			}
			{verse.note &&
				<VerseNote verse={verse} />
			}
		</Fragment>
	)
	lastVerse = verse
	return res
}
