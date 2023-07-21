import { h, render } from 'preact'
import { useEffect } from 'preact/hooks'
import Router from 'preact-router'
import { Home, About, Settings, SettingsType, NotFound } from './pages'
import { useLocalStorage } from './utils'
import './app.css'

function App() {
	const config = useLocalStorage('settings2', { cssVars: {} })[0] as SettingsType
	useEffect(() => {
		// Leave document for default styles, document.body to load styles
		const rootElement = document.body
		Object.keys(config.cssVars)
			.forEach(cssVar => rootElement.style.setProperty(cssVar, config.cssVars[cssVar]))
	}, []);

	return (
		<Router>
			<Home path="/" />
			<About path="/about" />
			<Settings path="/settings" />
			<NotFound default />
		</Router>
	)
}

render(
	<App />,
	document.getElementById('root') as HTMLElement
)
