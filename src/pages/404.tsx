import { h, Fragment } from 'preact'
import { Nav } from '../components'

export function NotFound(props: { path: String }) {
	return (
		<Fragment>
			<Nav />
			<div>
				{props.path} not found
			</div>
		</Fragment>
	)
}
