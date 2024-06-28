import { createSignal, createEffect, For, batch } from 'solid-js';
import { getChapterPath, BookId, bookNames } from '../../utils';
import { ForwardIcon, BackwardIcon } from '../../icons';
import { bibleIndices } from '../../settings';
import styles from './nav.module.css';

export interface ReaderNavProps {
	version: string;
	book: BookId;
	chapter: number;
	preload: boolean;
	onNavChange: (version: string, book: BookId, chapter: number) => void;
};

export function ReaderNav(props: ReaderNavProps) {
	const [version, setVersion] = createSignal(props.version);
	const [book, setBook] = createSignal<BookId>(props.book);
	const [chapter, setChapter] = createSignal(props.chapter);
	createEffect(() => props.onNavChange(version(), book(), chapter()));

	const [indices] = bibleIndices();
	const getIndices = () => indices() ?? {
		// Assume requested nav exists on static url.
		[version()]: {
			books: {
				[book()]: [chapter()],
			}
		}
	};
	const books = () => Object.keys(getIndices()[version()].books) as BookId[];
	function chapters(): number[] {
		const nChaptersOrChapters = getIndices()[version()].books[book()];
		if (Array.isArray(nChaptersOrChapters)) return nChaptersOrChapters;

		return Array.from({ length: nChaptersOrChapters }, (_, i) => i + 1);
	}

	function onVersionChange(newVersion: string) {
		batch(() => {
			setVersion(newVersion);
			const books = getIndices()?.[newVersion]?.books ?? {};
			if (!(book() in books)) {
				setBook((Object.keys(books) as BookId[])[0]);
				setChapterI(0);
			}
		});
	}

	function onBookChange(newBook: BookId) {
		batch(() => {
			setBook(newBook);
			setChapterI(0);
		});
	}

	function nextPreload() {
		if (!props.preload || !hasNextChapter(1)) return null;
		return <link rel="prefetch" href={getChapterPath(version(), book(), chapter() + 1)} />
	}
	const bookI = () => books().indexOf(book());
	const chapterI = () => chapters().indexOf(chapter());
	const setChapterI = (i: number) => setChapter(chapters()[i]);

	function nextChapter(n: number) {
		const nextChapter = chapters()[chapterI() + n];
		if (nextChapter) {
			setChapter(nextChapter);
		} else {
			const nextBook = books()[bookI() + n] as BookId;
			if (!nextBook) return;
			batch(() => {
				setBook(nextBook);
				if (n > 0) {
					setChapterI(0);
				} else {
					setChapterI(chapters().length - 1);
				}
			});
		}
	}

	function hasNextChapter(n: number): boolean {
		return Boolean(chapters()[chapterI() + n] || books()[bookI() + n]);
	}

	return (
		<nav class={styles.nav}>
			<select name="version" value={version()} onChange={ev => onVersionChange(ev.target.value)}>
				<For each={Object.keys(getIndices())}>
					{v => <option value={v}>{v.substring(3)}</option>}
				</For>
			</select>
			<select name="book" value={book()} onChange={ev => onBookChange(ev.target.value as BookId)}>
				<For each={books()}>
					{b => <option value={b}>{bookNames[b]}</option>}
				</For>
			</select>
			<select name="chapter" value={chapter()} onChange={ev => setChapter(+ev.target.value)}>
				<For each={chapters()}>
					{c => <option value={c}>{c}</option>}
				</For>
			</select>
			<button disabled={!hasNextChapter(-1)} onClick={() => nextChapter(-1)}>
				<BackwardIcon style={{ fill: '#5f6368' }} />
			</button>
			<button disabled={!hasNextChapter(1)} onClick={() => nextChapter(1)}>
				<ForwardIcon style={{ fill: '#5f6368' }} />
				{nextPreload()}
			</button>
		</nav>
	);
}
