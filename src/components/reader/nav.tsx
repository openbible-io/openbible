import { createSignal, createEffect, For, batch, Switch, Match, Suspense, createResource } from 'solid-js';
import { getChapterPath, BookId, bookNames } from '../../utils';
import { CaretForwardIcon, CaretBackIcon, InfoIcon } from '../../icons/index';
import { bibleIndices, BibleIndices, BibleIndex } from '../../settings';
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
			publisher: 'Unknown',
			title: 'Unknown',
			date: 'Unknown',
			modified: 'Unknown',
			license: 'Unknown',
			authors: ['Unknown'],
			books: {
				[book()]: [chapter()],
			}
		}
	} as BibleIndices;
	const versionInfo = () => getIndices()[version()];
	const books = () => Object.keys(versionInfo().books) as BookId[];
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
			<button popoverTarget="version-info">
				<InfoIcon style={{ fill: '#5f6368' }} width="1rem" height="1rem" />
			</button>
			<VersionInfo version={version()} {...versionInfo()} />
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
				<CaretBackIcon style={{ fill: '#5f6368' }} width="1rem" height="1rem" />
			</button>
			<button disabled={!hasNextChapter(1)} onClick={() => nextChapter(1)}>
				<CaretForwardIcon style={{ fill: '#5f6368' }} width="1rem" height="1rem" />
				{nextPreload()}
			</button>
		</nav>
	);
}

interface VersionInfoProps extends BibleIndex {
	version: string;
}

function VersionInfo(props: VersionInfoProps) {
	type View = 'info' | 'foreword';
	const [view, setView] = createSignal<View>('info');
	const [about] = createResource(async () => {
		if (!props.about) return null;
		const url = `${import.meta.env['OPENBIBLE_STATIC_URL']}/bibles/${props.version}/${props.about}.html`;
		console.log(url);
		return await fetch(url).then(res => res.text()).catch(e => console.error('caught', e));
	});

	return (
		<div popover id="version-info" class={styles.versionInfo}>
			<nav>
				<ul>
					{(['info', 'foreword'] as View[]).map(v =>
						<li>
							<button onClick={() => setView(v)}>
								{v}
							</button>
						</li>
					)}
				</ul>
			</nav>
			<Switch>
				<Match when={view() == 'info'}>
					<h1>{props.title}</h1>
					<div>Publisher: {props.publisher}</div>
					<div>Date: {props.date}</div>
					<div>Modified: {props.modified}</div>
					<div>License: {props.license}</div>
					<div>Authors:
						<ul class={styles.authors}>
							<For each={props.authors}>
								{name => <li>{name}</li>}
							</For>
						</ul>
					</div>
					<div>Books:
						<ol>
							<For each={Object.entries(props.books)}>
								{([name, n_chapters]) =>
									<li>{name}, {n_chapters} chapters</li>
								}
							</For>
						</ol>
					</div>
				</Match>
				<Match when={view() == 'foreword'}>
					<Suspense fallback="Loading...">
						<div innerHTML={about() ?? ''} />
					</Suspense>
				</Match>
			</Switch>
		</div>
	);
}
