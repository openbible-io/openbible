import { For } from 'solid-js';
import { Reader, ReaderProps } from '../reader/reader';
import { BookName, useLocalStorage } from '../../utils';
import styles from './readergroup.module.css';

export function ReaderGroup() {
	// Used only for initial reader loading and saving layout to local storage.
	// Each reader controls its own state.
	const [readers, setReaders] = useLocalStorage<ReaderProps[]>(
		'readers',
		[
			{ text: 'en_ust', book: 'LUK' as BookName, chapter: 4 },
			{ text: 'en_ust', book: 'PSA' as BookName, chapter: 119 },
		]
	);

	function onAddReader(index: number) {
		const newReaders = readers();
		newReaders.splice(index + 1, 0, {
			text: 'en_ust',
			book: 'MAT' as BookName,
			chapter: 1,
		});
		setReaders(newReaders);
	}

	function onCloseReader(index: number) {
		const newReaders = readers();
		newReaders.splice(index, 1);
		setReaders(newReaders);
	}

	function onReaderChange(index: number, text: string, book: BookName, chapter: number) {
		const newReaders = readers();
		Object.assign(newReaders[index], { text, book, chapter });
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
	);
}
