import { createSignal, createEffect, For, useContext } from 'solid-js';
import { getChapter, books, texts, BookName } from '../../utils';
import { ParagraphType } from '../../utils/books';
import { Paragraph } from '../paragraph/paragraph';
import { ForwardIcon, BackwardIcon } from '../../icons';
import styles from './reader.module.css';

const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);

export interface ReaderProps {
	text: string;
	book: BookName;
	chapter: number;
	onAddReader?: () => void;
	onCloseReader?: () => void;
	onNavChange?: (text: string, book: BookName, chapter: number) => void
	canClose?: boolean;
}

export function Reader(props: ReaderProps) {
	const [paragraphs, setParagraphs] = createSignal<ParagraphType[]>([])
	const [divRef, setDivRef] = createSignal<HTMLDivElement>()
	const maxChapter = books[props.book].chapters;

	createEffect(() => {
		getChapter(props.text, props.book, props.chapter).then(p => {
			setParagraphs(p);
			const ref = divRef();
			if (ref) ref.scrollTop = 0
		});
	});

	function onNavChange(text: string, book: BookName, chapter: number) {
		chapter = clamp(chapter, 1, maxChapter);
		if (props.onNavChange) props.onNavChange(text, book, chapter)
	};

	function onBookChange(ev: any) {
		const book = ev.target.value as BookName
		const chapter = clamp(props.chapter, 1, books[book].chapters);
		onNavChange(props.text, book, chapter)
	}

	const onChapterChange = (ev: any) => onNavChange(props.text, props.book, ev.target.value);
	const onTextChange = (ev: any) => onNavChange(ev.target.value, props.book, props.chapter);
	const nextChapter = () => onNavChange(props.text, props.book, props.chapter + 1);
	const prevChapter = () => onNavChange(props.text, props.book, props.chapter - 1);

	return (
		<article class={styles.article}>
			<div class={styles.navContainer}>
				<nav>
					<select name="book" value={props.book} onChange={onBookChange}>
						{Object.entries(books).map(([key, val]) =>
							<option value={key}>{val.name}</option>
						)}
					</select>
					<select name="chapter" value={props.chapter} onChange={onChapterChange}>
						{Array.apply(null, Array(books[props.book].chapters))
							.map((_el: unknown, i: number) =>
								<option value={i + 1}>{i + 1}</option>
						)}
					</select>
					<select name="text" value={props.text} onChange={onTextChange}>
						{Object.entries(texts).map(([key]) =>
							<option value={key}>{key}</option>
						)}
					</select>
				</nav>
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
			<div
				ref={setDivRef}
				class={styles.reader}
				tabIndex={0}
			>
				<For each={paragraphs()}>
					{p => <Paragraph {...p} />}
				</For>

				{paragraphs().length > 0 &&
					<div class={styles.endNav}>
						<button disabled={props.chapter == 1} onClick={prevChapter}>
							<BackwardIcon style={{ fill: '#5f6368' }} />
						</button>
						<button disabled={props.chapter == maxChapter} onClick={nextChapter}>
							<ForwardIcon style={{ fill: '#5f6368' }} />
						</button>
					</div>
				}
			</div>
		</article>
	)
}
