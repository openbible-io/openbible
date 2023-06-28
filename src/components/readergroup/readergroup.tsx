import { h, Fragment } from 'preact'
import { Reader, ReaderProps } from '../reader/reader'
import { BookName, useLocalStorage } from '../../utils'
import styles from './readergroup.css'

interface ReaderState extends ReaderProps {
	width: number;
}

/*
 * Contains many <Reader>s and handles resizing them
 */
export function ReaderGroup() {
	const [readers, setReaders] = useLocalStorage('readers', [
		{ text: 'en_ult', book: 'LUK' as BookName, chapter: 4, width: 50 },
		{ text: 'en_ult', book: 'PSA' as BookName, chapter: 119, width: 50 },
	] as ReaderState[])
	let preMoveMouseWidths: number[] = []
	let initialPageX = 0


	const updateReaders = () => {
		setReaders(Object.assign([], readers))
	}

	const onMouseMove = (ev: any, index: number) => {
		ev.preventDefault()
		const offsetXPercent = (ev.pageX - initialPageX) / window.innerWidth
		readers.forEach((reader, i) => {
			if (i === index)
				reader.width = preMoveMouseWidths[i] + offsetXPercent
			else if (i === index + 1)
				reader.width = preMoveMouseWidths[i] - offsetXPercent
		})
		updateReaders()
	}

	const mouseMoveHandler = (ev: any, index: any) => {
		ev.preventDefault()
		initialPageX = ev.pageX
		preMoveMouseWidths = readers.map(r => r.width)

		const handler = (ev: any) => onMouseMove(ev, index)
		document.addEventListener('mousemove', handler)
		document.addEventListener('mouseup', _ev =>
			document.removeEventListener('mousemove', handler))
	}

	const onAddReader = (index: number) => {
		index++
		const nextReader = readers[Math.min(index, readers.length - 1)]
		const newReader = { text: 'en_ult', book: 'MAT' as BookName, chapter: 1, width: nextReader.width / 2 }
		nextReader.width /= 2
		readers.splice(index, 0, newReader)
		updateReaders()
	}

	const onCloseReader = (index: number) => {
		const lastWidth = readers[index].width
		readers.splice(index, 1)
		readers.forEach(reader => reader.width += lastWidth / readers.length)
		updateReaders()
	}

	const onReaderChange = (reader: ReaderState, text: string, book: BookName, chapter: number) => {
		reader.text = text
		reader.book = book
		reader.chapter = chapter
		updateReaders()
	}

	return (
		<Fragment>
			{readers.map((reader, index) => (
				<Fragment key={index}>
					<Reader
						text={reader.text}
						book={reader.book}
						chapter={reader.chapter}
						style={{ width: `${reader.width * 100}%` }}
						onAddReader={() => onAddReader(index)}
						onCloseReader={() => onCloseReader(index)}
						onNavChange={(text, book, chapter) => onReaderChange(reader, text, book, chapter)}
					/>
					{index !== readers.length - 1 &&
						<div
							class={styles.dragbar}
							onMouseDown={e => mouseMoveHandler(e, index)}
						/>
					}
				</Fragment>
			))}
		</Fragment>
	)
}
