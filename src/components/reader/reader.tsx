import { createSignal, createEffect, For, createMemo, batch } from 'solid-js';
import { getChapter, books, texts, BookName, getChapterPath } from '../../utils';
import { ParagraphType } from '../../utils/books';
import { Paragraph } from '../paragraph/paragraph';
import { ForwardIcon, BackwardIcon } from '../../icons';
import styles from './reader.module.css';
import paraStyles from '../paragraph/paragraph.module.css';

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
	const [text, setText] = createSignal(props.text);
	const [book, setBook] = createSignal(props.book);
	const [chapter, setChapter] = createSignal(props.chapter);

	const [paragraphs, setParagraphs] = createSignal<ParagraphType[]>([]);
	const [divRef, setDivRef] = createSignal<HTMLDivElement>();

	createEffect(() => {
		getChapter(text(), book(), chapter()).then(p => {
			setParagraphs(p);
			const ref = divRef();
			if (ref) ref.scrollTop = 0;
		});
		if (props.onNavChange) props.onNavChange(text(), book(), chapter());
	});

	const nextChapter = () => setChapter(c => clamp(c + 1, 1, books[book()].chapters));
	const prevChapter = () => setChapter(c => clamp(c - 1, 1, books[book()].chapters));
	const prevDisabled = createMemo(() => chapter() == 1);
	const nextDisabled = createMemo(() => chapter() == books[book()].chapters);
	const nextPreload = createMemo(() => nextDisabled()
		? null
		: <link rel="prefetch" href={getChapterPath(text(), book(), chapter() + 1)} />
	);

	return (
		<article class={styles.article}>
			<div class={styles.navContainer}>
				<nav>
					<select name="book" value={book()} onChange={ev => {
						const newBook = ev.target.value as BookName;
						batch(() => {
							setBook(newBook);
							setChapter(clamp(props.chapter, 1, books[newBook].chapters));
						});
					}}>
						{Object.entries(books).map(([key, val]) =>
							<option value={key}>{val.name}</option>
						)}
					</select>
					<select name="chapter" value={chapter()} onChange={ev => setChapter(+ev.target.value)}>
						{[...Array(books[props.book].chapters).keys()]
							.map((_el: unknown, i: number) =>
								<option value={i + 1}>{i + 1}</option>
						)}
					</select>
					<select name="text" value={props.text} onChange={ev => setText(ev.target.value)}>
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
				<For each={paragraphs()} fallback={<Loading />}>
					{p => <Paragraph {...p} />}
				</For>
			</div>
			<div class={styles.endNav}>
				<button disabled={prevDisabled()} onClick={prevChapter}>
					<BackwardIcon style={{ fill: '#5f6368' }} />
				</button>
				<button disabled={nextDisabled()} onClick={nextChapter}>
					<ForwardIcon style={{ fill: '#5f6368' }} />
					{nextPreload()}
				</button>
			</div>
		</article>
	);
}

function Loading() {
	// TODO: skeleton with correct number of verses
	return (
		<p class={paraStyles.p} style={{ height: '100vh' }}>Loading</p>
	);
}
