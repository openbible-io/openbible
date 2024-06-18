import { h } from 'preact'
import styles from './button.module.css'

interface ButtonProps {
	children: h.JSX.Element | h.JSX.Element[];
	icon?: h.JSX.Element | h.JSX.Element[];
	onClick?: h.JSX.MouseEventHandler<HTMLButtonElement>;
}

console.log(styles)
export function Button(props: ButtonProps) {
	return (
		<button class={styles['mdc-button']} onClick={props.onClick}>
			<div class={styles['mdc-button__ripple']}></div>
			<span class={styles['mdc-button__label']}>
				{props.children}
			</span>
		</button>
	)
}
