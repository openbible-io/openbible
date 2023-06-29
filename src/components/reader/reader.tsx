import { h } from 'preact'
import { useState, useRef, useEffect } from 'preact/hooks'
import { getChapter, books, texts, BookName, useLocalStorage } from '../../utils'
import styles from './reader.css'
import { defaultSettings } from '../../pages'
import { ParagraphType } from '../../utils/books'
import { Paragraph } from '../paragraph/paragraph'
import { ForwardIcon, BackwardIcon } from '../../icons'

const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);

export interface ReaderProps {
	text: string;
	book: BookName;
	chapter: number;
	// TODO: how to copy JSXInternal.HTMLAttributes<HTMLElement>.style?: string | {
	style?: { [key: string]: string | number } | string;
	onAddReader?: () => void;
	onCloseReader?: () => void;
	onNavChange?: (text: string, book: BookName, chapter: number) => void
}

export function Reader(props = {
	book: books.GEN.name,
	chapter: 1,
	text: 'en_ust',
} as ReaderProps) {
	const [paragraphs, setParagraphs] = useState([] as ParagraphType[])
	const [settings,] = useLocalStorage('settings', defaultSettings);
	const divRef = useRef<HTMLDivElement>(null)
	const maxChapter = books[props.book].chapters;

	useEffect(() => {
		getChapter(props.text, props.book, props.chapter).then(setParagraphs)
	}, [])

	const onNavChange = (text: string, book: BookName, chapter: number) => {
		chapter = clamp(chapter, 1, maxChapter);
		getChapter(text, book, chapter)
			.then(paragraphs => {
				setParagraphs(paragraphs)
				if (divRef.current) {
					divRef.current.scrollTop = 0
				}
			})
		if (props.onNavChange) {
			props.onNavChange(text, book, chapter)
		}
	}

	const onBookChange = (ev: any) => {
		const book = ev.target.value as BookName
		let chapter = props.chapter
		if (chapter > books[book].chapters)
			chapter = books[book].chapters
		onNavChange(props.text, book, chapter)
	}

	const onChapterChange = (ev: any) => {
		onNavChange(props.text, props.book, ev.target.value)
	}

	const onTextChange = (ev: any) => {
		onNavChange(ev.target.value, props.book, props.chapter)
	}

	const nextChapter = () => onNavChange(props.text, props.book, props.chapter + 1);
	const prevChapter = () => onNavChange(props.text, props.book, props.chapter - 1);

	const onKeyDown = (ev: any) => {
		if (settings.nextChapter.includes(ev.key)) nextChapter();
		if (settings.prevChapter.includes(ev.key)) prevChapter();
	}

	const style = props.style || {}
	return (
		<article class={styles.article} style={style} onKeyDown={onKeyDown}>
			<div class={styles.navContainer}>
				<nav>
					<select name="book" value={props.book} onChange={onBookChange}>
						{Object.entries(books).map(([key, val]) =>
							<option value={key} key={key}>{val.name}</option>
						)}
					</select>
					<select name="chapter" value={props.chapter} onChange={onChapterChange}>
						{Array.apply(null, Array(books[props.book].chapters))
							.map((_el: unknown, i: number) =>
								<option value={i + 1} key={i}>{i + 1}</option>
						)}
					</select>
					<select name="text" value={props.text} onChange={onTextChange}>
						{Object.entries(texts).map(([key, val]) =>
							<option value={key} key={key}>{key}</option>
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
					>
						x
					</button>
				</div>
			</div>
			<div
				ref={divRef}
				class={styles.reader}
				tabIndex={0}
			>
				{paragraphs.map(Paragraph)}

				<div class={styles.endNav}>
					<button disabled={props.chapter == 1} onClick={prevChapter}>
						<BackwardIcon style={{ fill: '#5f6368' }} />
					</button>
					<button disabled={props.chapter == maxChapter} onClick={nextChapter}>
						<ForwardIcon style={{ fill: '#5f6368' }} />
					</button>
				</div>
			</div>
		</article>
	)
}
