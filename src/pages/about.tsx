import { repository } from '../../package.json';

export function About() {
	return (
		<div>
			<h2>About</h2>
			<ul>
				<li><a target="_blank" href={repository as unknown as string}>GitHub</a></li>
			</ul>
		</div>
	);
}
