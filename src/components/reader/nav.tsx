import { createSignal, createEffect, For, batch, Switch, Match, Suspense, createResource, ResourceReturn, JSX, } from 'solid-js';
import { getChapterPath, BookId, bookNames, fetchHtml } from '../../utils';
import { CaretForwardIcon, CaretBackIcon, InfoIcon, ThreeDotsVerticalIcon } from '../../icons/index';
import { Dropdown } from '../index';
import { BibleIndices, BibleIndex } from '../../settings';
import styles from './nav.module.css';

// Only fetch this once.
let indexCache: ResourceReturn<BibleIndices> | undefined;

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

	indexCache = indexCache || createResource<BibleIndices>(async () =>
		 await fetch(`${import.meta.env['OPENBIBLE_STATIC_URL']}/bibles/index.json`)
			.then(res => res.json() as Promise<BibleIndices>)
	);
	const [indices] = indexCache;
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
		const next = getNextChapter(1);
		return (
			<link
				rel="prefetch"
				crossorigin="anonymous"
				href={getChapterPath(version(), next.book, next.chapter)}
			/>
		);
	}
	const bookI = () => books().indexOf(book());
	const chapterI = () => chapters().indexOf(chapter());
	const setChapterI = (i: number) => setChapter(chapters()[i]);

	function onNextChapter(n: number) {
		const next = getNextChapter(n);
		batch(() => {
			setBook(next.book);
			setChapter(next.chapter);
		});
	}

	function getNextChapter(n: number) {
		let nextBook = book();
		let nextChapter = chapters()[chapterI() + n];
		if (!nextChapter) {
			nextBook = books()[bookI() + n] as BookId;
			if (nextBook) {
				const chaps = chapters();
				nextChapter = n > 0 ? chaps[0] : chaps[chaps.length - 1];
			}
		}

		return { book: nextBook, chapter: nextChapter };
	}

	function hasNextChapter(n: number): boolean {
		return Boolean(chapters()[chapterI() + n] || books()[bookI() + n]);
	}

	const nav = (
		<nav class={styles.nav}>
			<select name="version" value={version()} onChange={ev => onVersionChange(ev.target.value)}>
				<For each={Object.keys(getIndices())}>
					{v => <option value={v}>{v}</option>}
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
			<button disabled={!hasNextChapter(-1)} onClick={() => onNextChapter(-1)}>
				<CaretBackIcon style={{ fill: '#5f6368' }} width="1rem" height="1rem" />
			</button>
			<button disabled={!hasNextChapter(1)} onClick={() => onNextChapter(1)}>
				<CaretForwardIcon style={{ fill: '#5f6368' }} width="1rem" height="1rem" />
				{nextPreload()}
			</button>
		</nav>
	);

	return (
		<div class={styles.container}>
			<Dropdown
				button={{
					class: styles.dropdown,
					children: <ThreeDotsVerticalIcon style={{ fill: '#5f6368' }} width="1rem" height="1rem" />
				}}
				div={{
					class: styles.popover,
					children: nav
				}}
			/>
		</div>
	);
}

interface VersionInfoProps extends BibleIndex {
	version: string;
}

function VersionInfo(props: VersionInfoProps) {
	type View = 'info' | 'foreword';
	const [view, setView] = createSignal<View>('info');
	const [about, setAbout] = createSignal('Loading...');
	createEffect(() => {
		if (!props.about) return setAbout('No foreword');
		const url = `${import.meta.env['OPENBIBLE_STATIC_URL']}/bibles/${props.version}/${props.about}.html`;
		fetchHtml(url).then(setAbout);
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

function isOverflown(element: HTMLElement) {
  return element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;
}

