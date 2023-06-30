import { h, Fragment } from 'preact'
import { Nav, Reader } from '../components'
import { useLocalStorage, cssVars } from '../utils'
import cssVariables from '!css-variables!../app.css'
import styles from './settings.css'
import readerStyles from '../components/reader/reader.css'

export interface SettingsType {
	selectVerseNums: boolean;
	nextChapter: string[];
	prevChapter: string[];
	cssVars: {
		[cssVar: string]: string;
	}
}

export const defaultSettings = {
	selectVerseNums: false,
	nextChapter: ['ArrowRight', 'l'],
	prevChapter: ['ArrowLeft', 'h'],
	cssVars: cssVariables
} as SettingsType

export function Settings(_props: { path: String }) {
	const [config, setConfig] = useLocalStorage('settings2', defaultSettings)

	const setCSSVar = (cssVar: string, cssValue: string) => {
		document.body.style.setProperty(cssVar, cssValue)
		config.cssVars[cssVar] = cssValue
		setConfig(Object.assign({}, config))
	}

	const onReset = (ev: h.JSX.TargetedEvent<HTMLFormElement, Event>) => {
		ev.preventDefault()
		cssVars.forEach(cssVar => {
			const cssVal = getComputedStyle(document.documentElement)
				.getPropertyValue(cssVar)
				.trim()
			setCSSVar(cssVar, cssVal)
		})
		setConfig({ ...config, ...defaultSettings })
	}

	const onSubmit = (ev: h.JSX.TargetedEvent<HTMLFormElement, Event>) => {
		ev.preventDefault()
		// TODO: web service
		console.log('save settings')
	}

	return (
		<Fragment>
			<Nav />
			<main>
				<form class={styles.form} onSubmit={onSubmit} onReset={onReset}>
					<h2>CSS Variables</h2>
					{Object.entries(config.cssVars)
						.map(entry => (
							<p key={entry[0]}>
								<label>{entry[0]}</label>
								<input
									type={entry[0].includes('color') ? 'color' : ''}
									value={entry[1]}
									onInput={(ev: any) => setCSSVar(entry[0], ev.target.value)}
									/>
							</p>
					))}
					<p>
						Select verse numbers (requires refresh)
						<input type="checkbox" checked={config.selectVerseNums} onInput={() =>
							setConfig({ ...config, selectVerseNums: !config.selectVerseNums })
						}/>
					</p>
					<input type="reset" value="Reset settings" />
					<input type="submit" value="Save settings" />
				</form>
				<div class={`${readerStyles.reader} ${styles.testDiv}`}>
					<Reader text="en_ult" book="PSA" chapter={119} canClose={false} />
				</div>
			</main>
		</Fragment>
	)
}
