import { h, Fragment } from 'preact'
import { VerseType } from '../../utils/books'
import styles from './verse.css'
import { useLocalStorage, classnames } from '../../utils';
import { defaultSettings } from '../../pages'

export function Verse(props: VerseType) {
	const [config,] = useLocalStorage('settings2', defaultSettings)
	return (
		<Fragment>
			{props.number && <sup class={classnames(styles.sup, !config.selectVerseNums && styles.unselectable)}>{props.number}</sup>}
			{props.text && <span>{props.text} </span>}
		</Fragment>
	);
}
