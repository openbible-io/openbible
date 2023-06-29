import { h, Fragment } from 'preact'
import { Nav } from '../components'

export function About(_props: { path: String }) {
	return (
		<Fragment>
			<Nav />
			<main>
				<div>
					<h2>About</h2>
					<p>
						Open source interactive Bible study tool.
					</p>
				</div>
			</main>
		</Fragment>
	)
}
