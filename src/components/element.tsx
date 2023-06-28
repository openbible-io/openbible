import { h, Fragment } from 'preact'
import { ElementType } from '../utils/books'


export function Element(props: ElementType) {
	if (props.type == 'verse') {
		return (
			<Fragment>
				<sup>{props.number}</sup>
				<span>{props.text} </span>
			</Fragment>
		);
	} else if (props.type == 'br') {
		return <br />;
	}
	console.warn('unknown element type', props.type)
	return <Fragment></Fragment>;
}
