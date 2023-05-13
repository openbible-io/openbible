import { h } from 'preact'
import { useState, useRef, useEffect } from 'preact/hooks'
import { getChapter, books, texts, BookNames, useLocalStorage, subscribe, visitParagraphs } from '../../utils'
import { ParagraphType, NoteType } from '../../utils/books'
import { Highlight, Highlights } from '../../types/highlights'
import { onSelectChange, onCopy, selectedNodes, getRange } from '../paragraphs/select'
import { NoteContext } from '../paragraphs/versenotecontext'
import { Paragraphs } from '../paragraphs/paragraphs'
import { Notes } from '../../types/notes'
import styles from './reader.css'
import { defaultSettings } from '../../pages'
// import { onAddNote } from '../../actions/onAddNote'

const clearSelection = () => {
	const selection = document.getSelection()
	if (selection) {
		selection.removeAllRanges()
	}
}

export interface ReaderProps {
	text: string;
	book: BookNames;
	chapter: number;
	// TODO: how to copy JSXInternal.HTMLAttributes<HTMLElement>.style?: string | {
	style?: { [key: string]: string | number } | string;
	onAddReader?: () => void;
	onCloseReader?: () => void;
	onNavChange?: (text: string, book: BookNames, chapter: number) => void
}

export function Reader(props = {
	book: books.GEN.name,
	chapter: 1,
	text: Object.keys(texts)[0]
} as ReaderProps) {
	const [paragraphs, setParagraphs] = useState([] as ParagraphType[])
	const [highlights, setHighlights] = useLocalStorage(`highlight1-${props.book}-${props.chapter}`, {} as Highlights);
	const [notes, setNotes] = useLocalStorage(`note1-${props.book}-${props.chapter}`, {} as Notes);
	const [config,] = useLocalStorage('settings', defaultSettings);
	const divRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		getChapter(props.text, props.book, props.chapter)
			.then(paragraphs => {
				let highlight: Highlight | undefined
				let note: NoteType | undefined
				visitParagraphs(paragraphs, (verse, parent) => {
					verse.parent = parent
					if (!highlight) {
						highlight = highlights[verse.id]
					}
					if (highlight) {
						verse.highlight = highlight.color
						if (verse.id >= highlight.toId) {
							highlight = undefined
						}
					}

					const savedNote = notes[verse.id]
					if (!note && savedNote) {
						note = {
							fromId: verse.id,
							toId: savedNote.toId,
							note: savedNote.note,
							isFormOpen: false,
						}
					}
					if (note) {
						verse.noted = verse.id
						if (verse.id >= note.toId) {
							verse.note = note
							note = undefined
						}
					}
				})
				setParagraphs(paragraphs)
				subscribe('ADD_NOTE', () => onAddNote(paragraphs))
				subscribe('ADD_HIGHLIGHT', (color: string) => onAddHighlight(paragraphs, color))
			})
	}, [])

	const onNavChange = (text: string, book: BookNames, chapter: number) => {
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
		const book = ev.target.value as BookNames
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

	const getSelectedNodes = () => {
		if (!getRange()) {
			return
		}
		const ids = selectedNodes
			.filter(node => divRef.current && divRef.current.contains(node))
			.map(node => (node as Element).getAttribute('data-id'))
			.filter(Boolean)
		if (ids.length > 0) {
			return {
				fromId: +(ids as string[])[0],
				toId: +(ids as string[])[ids.length - 1]
			}
		}
	}

	const onAddNote = (paragraphs: ParagraphType[]) => {
		const selected = getSelectedNodes()
		if (selected && selected.fromId && selected.toId) {
			const fromId = selected.fromId
			const toId = selected.toId
			visitParagraphs(paragraphs, v => {
				if (v.id >= fromId && v.id <= toId) {
					v.noted = selected.fromId
				}
				if (v.id === toId) {
					v.note = { fromId, toId, note: '', isFormOpen: true }
				}
			})

			clearSelection()
			setParagraphs(Object.assign([], paragraphs))
		}
	}

	const onAddHighlight = (paragraphs: ParagraphType[], color: string) => {
		const selected = getSelectedNodes()
		if (!selected) {
			return
		}

		if (selected.fromId && selected.toId) {
			const fromId = selected.fromId
			const toId = selected.toId
			visitParagraphs(paragraphs, verse => {
				if (verse.id >= fromId && verse.id <= toId) {
					verse.highlight = color
				}
			})

			clearSelection()
			highlights[fromId] = { toId: toId, color }
			setHighlights(Object.assign({}, highlights))
			setParagraphs(Object.assign([], paragraphs))
		}
	}

	const onNoteSubmit = (note: NoteType) => {
		notes[note.fromId] = { toId: note.toId, note: note.note }
		setNotes(Object.assign({}, notes))
		setParagraphs(Object.assign([], paragraphs))
	}

	const onNoteRemove = (note: NoteType) => {
		const fromId = note.fromId
		const toId = note.toId
		visitParagraphs(paragraphs, v => {
			if (v.id >= fromId && v.id <= toId) {
				delete v.noted
			}
			if (v.id === toId) {
				delete v.note
			}
		})
		setParagraphs(Object.assign([], paragraphs))
	}

	const style = props.style || {}
	return (
		<article class={styles.article} style={style}>
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
				onMouseUp={onSelectChange}
				onKeyUp={onSelectChange}
				class={styles.reader}
				onCopy={(ev: any) => onCopy(ev, config)}
				tabIndex={0}
			>
				<NoteContext.Provider value={{ onNoteSubmit, onNoteRemove }}>
					<Paragraphs	paragraphs={paragraphs} />
				</NoteContext.Provider>
			</div>
		</article>
	)
}
