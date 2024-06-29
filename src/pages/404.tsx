import { Location } from '@solidjs/router';

export function NotFound(props: { location: Location }) {
	return (
		<>
			<div>
				{props.location.pathname} not found
			</div>
		</>
	);
}
