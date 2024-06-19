import { render } from 'solid-js/web';
import { Router, Route } from '@solidjs/router';
import { Home, About, Settings, NotFound } from './pages';
import { createInteraction, Interaction, createCssVars, CssVars } from './settings';
import './app.css';

function App() {
	return (
		<Interaction.Provider value={createInteraction()}>
			<CssVars.Provider value={createCssVars()}>
				<Router>
					<Route component={About} path="/about" />
					<Route component={Home} path="/" />
					<Route component={Settings} path="/settings" />
					<Route component={NotFound} path="*" />
				</Router>
			</CssVars.Provider>
		</Interaction.Provider>
	);
}

render(App, document.getElementById('root') as HTMLElement);
