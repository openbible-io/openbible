import { h } from 'preact'
import { Link, LinkProps } from 'preact-router/match';
import styles from './nav.css'
import { repository } from '../../../package.json';

const NavLink = (props: Omit<LinkProps, 'activeClassName'>) => (
	<Link activeClassName="" {...props} />
)

export function Nav() {
	return (
		<header class={styles.header}>
			<nav class={styles.navbarGrow}>
				<ul class={styles.navbar}>
					<li>
						<h1>
							<NavLink class={styles.navbarBrand} href="/">
								Open Bible
							</NavLink>
						</h1>
					</li>
				</ul>
			</nav>
			<div style={{ display: 'flex' }}>
				<ul class={styles.navbar}>
					<li><NavLink href="/about">About</NavLink></li>
					<li><NavLink href="/settings">Settings</NavLink></li>
					<li><a target="_blank" href={repository as unknown as string}>GitHub</a></li>
				</ul>
				<form class={styles.form}>
					<input placeholder="Search"></input>
				</form>
			</div>
		</header>
	)
}
