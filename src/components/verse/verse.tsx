import { useContext } from 'solid-js';
import { VerseType } from '../../utils';
import { Interaction } from '../../settings'
import styles from './verse.module.css'

export function Verse(props: VerseType) {
	const interaction = useContext(Interaction);
	return (
		<>
			{props.number &&
				<sup classList={{
					[styles.sup]: true,
					[styles.unselectable]: interaction && !interaction['select-verse-nums'][0](),
				}}>
					{props.number}
				</sup>
			}
			{props.text && <span>{props.text} </span>}
		</>
	);
}
