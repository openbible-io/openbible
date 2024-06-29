import { JSX, createUniqueId } from 'solid-js';
import styles from './dropdown.module.css';

export interface DropdownProps {
	buttonChildren: JSX.Element;
	children: JSX.Element;
};
export function Dropdown(props: DropdownProps) {
	const id = createUniqueId();
	const target = `--${createUniqueId()}`;

	return (
		<>
			<button
				popoverTarget={id}
				popoverTargetAction="toggle"
				style={`anchor-name: ${target}`}
			>
				{props.buttonChildren}
			</button>
			<div
				popover="auto"
				id={id}
				class={styles.popover}
				style={{
					top: `anchor(${target} bottom)`,
					left: `anchor(${target} left)`,
				}}
			>
				{props.children}
			</div>
		</>
	);
}
