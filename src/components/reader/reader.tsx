import { createSignal } from 'solid-js';
import { ReaderNav } from './nav';
import { getChapter, BookId } from '../../utils';
import styles from './reader.module.css';

export interface ReaderProps {
	version: string;
	book: BookId;
	chapter: number;
	onAddReader?: () => void;
	onCloseReader?: () => void;
	onNavChange?: (version: string, book: string, chapter: number) => void
	canClose?: boolean;
};

export function Reader(props: ReaderProps) {
	const [divRef, setDivRef] = createSignal<HTMLDivElement>();

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

	return (
		<article class={styles.article}>
			<div class={styles.navContainer}>
				<ReaderNav
					version={props.version}
					book={props.book}
					chapter={props.chapter}
					onNavChange={onNavChange}
					preload={true}
				/>
				<div>
					<button
						onClick={props.onAddReader}
						class={styles.windowButton}
					>
						+
					</button>
					<button
						onClick={props.onCloseReader}
						class={styles.windowButton}
						disabled={!props.canClose}
					>
						x
					</button>
				</div>
			</div>
			<div ref={setDivRef} class={styles.reader} tabIndex={0}>
				Loading...
			</div>
		</article>
	);
}
