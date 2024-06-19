import { render } from 'solid-js/web';
import { Router, Route, RouteSectionProps } from '@solidjs/router';
import { Nav } from './components';
import { Home, About, Settings, NotFound } from './pages';
import { createInteraction, Interaction, createCssVars, CssVars } from './settings';
import './app.css';

function App() {
	return (
		<Interaction.Provider value={createInteraction()}>
			<CssVars.Provider value={createCssVars()}>
				<Router root={Root}>
					<Route component={About} path="/about" />
					<Route component={Home} path="/" />
					<Route component={Settings} path="/settings" />
					<Route component={NotFound} path="*" />
				</Router>
			</CssVars.Provider>
		</Interaction.Provider>
	);
}

function Root(props: RouteSectionProps<unknown>) {
	return (
		<>
			<Nav />
			<main>
				{props.children}
			</main>
		</>
	);
}

render(App, document.getElementById('root') as HTMLElement);
