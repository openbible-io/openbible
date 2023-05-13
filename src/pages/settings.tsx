import { h, Fragment } from 'preact'
import { Nav, Reader } from '../components'
import { useLocalStorage, cssVars } from '../utils'
import cssVariables from '!css-variables!../app.css'
import styles from './settings.css'
import readerStyles from '../components/reader/reader.css'

export interface SettingsType {
	selectVerseNums: string;
	cssVars: {
		[cssVar: string]: string;
	}
}

export const defaultSettings = {
	selectVerseNums: 'noSelect',
	cssVars: cssVariables
} as SettingsType

export function Settings(_props: { path: String }) {
	const [config, setConfig] = useLocalStorage('settings2', defaultSettings)

	const setCSSVar = (cssVar: string, cssValue: string) => {
		document.body.style.setProperty(cssVar, cssValue)
		config.cssVars[cssVar] = cssValue
		setConfig(Object.assign({}, config))
	}

	const onSettingInput = (key: string, val: string) => {
		config[key as 'selectVerseNums'] = val
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
					<h2>Copy behavior</h2>
					<p>
						<label>Snap selection to words</label>
						TODO: code no snapping but still snapping for highlighting
					</p>
					<p>
						<label>Verse number selection</label>
						<select
							value={config.selectVerseNums}
							onChange={(ev: any) => onSettingInput('selectVerseNums', ev.target.value)}
						>
							<option value="noSelect">Don't select</option>
							<option value="addSpace">Add space</option>
							<option value="default">Browser default</option>
						</select>
					</p>
					<input type="reset" value="Reset settings" />
					<input type="submit" value="Save settings" />
				</form>
				<div class={`${readerStyles.reader} ${styles.testDiv}`}>
					<Reader text="en_ult" book="PSA" chapter={119} />
				</div>
			</main>
		</Fragment>
	)
}
