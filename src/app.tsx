import { render } from 'solid-js/web';
import { Router, Route, RouteSectionProps } from '@solidjs/router';
import { Nav } from './components';
import { Home, About, Settings, NotFound } from './pages';
import { createCssVars, CssVars } from './settings';
import './app.css';

function App() {
	return (
		<CssVars.Provider value={createCssVars()}>
			<Router root={Root}>
				<Route component={Home} path="/" />
				<Route component={About} path="/about" />
				<Route component={Settings} path="/settings" />
				<Route component={NotFound} path="*" />
			</Router>
		</CssVars.Provider>
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
