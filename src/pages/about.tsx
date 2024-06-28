import { repository } from '../../package.json';

export function About() {
	return (
		<div>
			<h1>About</h1>
			<ul>
				<li><a target="_blank" href={repository as unknown as string}>GitHub</a></li>
			</ul>
		</div>
	);
}
