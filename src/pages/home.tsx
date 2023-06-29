import { h, Fragment } from 'preact'
import { Nav, ReaderGroup, Toolbar } from '../components'

export const Home = (_props: { path: String }) => {
	return (
		<Fragment>
			<Nav />
			{/*<Toolbar />*/}
			<main>
				<ReaderGroup />
			</main>
		</Fragment>
	)
}
