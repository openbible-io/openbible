import { For } from 'solid-js';
import { Reader, ReaderProps } from '../reader/reader'
import { BookName, useLocalStorage } from '../../utils'
import styles from './readergroup.module.css'

export function ReaderGroup() {
	const [readers, setReaders] = useLocalStorage<ReaderProps[]>(
		'readers',
		[
			{ text: 'en_ult', book: 'LUK' as BookName, chapter: 4 },
			{ text: 'en_ult', book: 'PSA' as BookName, chapter: 119 },
		]
	);

	function onAddReader(index: number) {
		const newReader: ReaderProps  = {
			text: 'en_ult',
			book: 'MAT' as BookName,
			chapter: 1,
		};
		const newReaders = [...readers()];
		newReaders.splice(index + 1, 0, newReader)
		setReaders(newReaders);
	}

	function onCloseReader(index: number) {
		const newReaders = [...readers()];
		newReaders.splice(index, 1);
		setReaders(newReaders);
	}

	function onReaderChange(index: number, text: string, book: BookName, chapter: number) {
		const newReaders = readers().map((r, i) => {
			if (i == index) return { text, book, chapter };
			return r;
		});
		setReaders(newReaders);
	}

	return (
		<For each={readers()}>
			{(reader, index) =>
				<>
					<Reader
						text={reader.text}
						book={reader.book}
						chapter={reader.chapter}
						onAddReader={() => onAddReader(index())}
						onCloseReader={() => onCloseReader(index())}
						onNavChange={(text, book, chapter) => onReaderChange(index(), text, book, chapter)}
						canClose={readers().length > 1}
					/>
					{index() !== readers().length - 1 &&
						<div class={styles.dragbar} />
					}
				</>
			}
		</For>
	)
}
