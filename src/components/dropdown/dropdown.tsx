import { JSX, createSignal, createUniqueId } from 'solid-js';
import styles from './dropdown.module.css';

export interface DropdownProps {
	button: JSX.ButtonHTMLAttributes<HTMLButtonElement>;
	div: JSX.HTMLAttributes<HTMLDivElement>;
};
export function Dropdown(props: DropdownProps) {
	const [button, setButton] = createSignal<HTMLButtonElement>();
	const id = createUniqueId();
	const div = (
		<div
			{...props.div}
			id={id}
			class={`${props.div.class ?? ''} ${styles.popover}`}
			popover
			onBeforeToggle={ev => {
				const b = button();
				const d = ev.target;
				if (!b || !d) return;
				const { x, y, height } = b.getBoundingClientRect();
				d.style.left = `${x}px`;
				d.style.top = `${y + height}px`;
			}}
		/>
	) as HTMLDivElement;

	return (
		<>
			<button
				{...props.button}
				ref={setButton}
				popoverTarget={id}
			/>
			{div}
		</>
	);
}
