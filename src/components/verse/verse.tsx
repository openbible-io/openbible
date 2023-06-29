import { h, Fragment } from 'preact'
import { VerseType } from '../../utils/books'
import styles from './verse.css'

export function Verse(props: VerseType) {
	return (
		<Fragment>
			{props.number && <sup class={styles.sup}>{props.number}</sup>}
			{props.text && <span>{props.text} </span>}
		</Fragment>
	);
}
