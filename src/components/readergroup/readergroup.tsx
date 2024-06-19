import { For } from 'solid-js';
import { Reader, ReaderProps } from '../reader/reader';
import { BookName, useLocalStorage } from '../../utils';
import styles from './readergroup.module.css';

const defaultReaders = [
	{ text: 'en_ust', book: 'GEN' as BookName, chapter: 1 },
	{ text: 'en_ust', book: 'MAT' as BookName, chapter: 1 },
];

export function ReaderGroup() {
	// Used only for initial reader loading and saving layout to local storage.
	// Each reader controls its own state.
	const [readers, setReaders] = useLocalStorage<ReaderProps[]>('readers', defaultReaders);
	if (readers().length == 0) setReaders(defaultReaders);

	function onAddReader(index: number) {
		const newReaders = [...readers()];
		newReaders.splice(index + 1, 0, defaultReaders[0]);
		setReaders(newReaders);
	}

	function onCloseReader(index: number) {
		const newReaders = [...readers()];
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
