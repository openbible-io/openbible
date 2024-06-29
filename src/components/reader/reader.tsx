import { createSignal, createUniqueId, JSX, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { SettingsIcon, SolidBibleIcon, SolidPlusIcon, SolidXIcon } from '../../icons/index';
import { ReaderNav } from './nav';
import { getChapter, BookId } from '../../utils';
import styles from './reader.module.css';

export interface ReaderProps {
	version: string;
	book: BookId;
	chapter: number;
	onAddReader?: () => void;
	onCloseReader?: () => void;
	onNavChange?: (version: string, book: BookId, chapter: number) => void
	canClose?: boolean;
	class?: string;
};

export function Reader(props: ReaderProps) {
	const [divRef, setDivRef] = createSignal<HTMLDivElement>();

	const id = `--${createUniqueId()}`;
	function onNavChange(version: string, book: BookId, chapter: number) {
		getChapter(version, book, chapter).then(html => {
			const ref = divRef();
			if (ref) {
				ref.scrollTop = 0;
				ref.innerHTML = html;
			}
		});
		if (props.onNavChange) props.onNavChange(version, book, chapter);
	}

	const WindowButtons = (props2: JSX.HTMLAttributes<HTMLElement>) => (
		<span class={styles.windowButtons} {...props2}>
			<button
				onClick={props.onAddReader}
				class={styles.windowButton}
			>
				<SolidPlusIcon style={{ fill: '#5f6368' }} height="1rem" width="1rem" />
			</button>
			<button
				onClick={props.onCloseReader}
				class={styles.windowButton}
				disabled={!props.canClose}
			>
				<SolidXIcon style={{ fill: '#5f6368' }} height="1rem" width="1rem" />
			</button>
		</span>
	);

	return (
		<article class={`${styles.article} ${props.class ?? ''}`} style={`anchor-name: ${id}`}>
			<header>
				<ReaderNav
					version={props.version}
					book={props.book}
					chapter={props.chapter}
					onNavChange={onNavChange}
					preload={true}
				/>
				<WindowButtons style={{ visibility: 'hidden' }} /> {/* These are for making ReaderNav overflow */}
				<WindowButtons style={{
					position: 'absolute',
					top: `anchor(${id} top)`,
					right: `anchor(${id} right)`,
				}} />
			</header>
			<div ref={setDivRef} class={styles.reader} tabIndex={0}>
				Loading...
			</div>
		</article>
	);
}
