import { Nav } from '../components';
import { Location } from '@solidjs/router';

export function NotFound(props: { location: Location }) {
	return (
		<>
			<Nav />
			<div>
				{props.location.pathname} not found
			</div>
		</>
	);
}
