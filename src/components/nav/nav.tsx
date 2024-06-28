import { A as Link, AnchorProps as LinkProps } from '@solidjs/router';
import styles from './nav.module.css';

const NavLink = (props: Omit<LinkProps, 'activeClass'>) => (
	<Link activeClass="" {...props} />
);

export function Nav() {
	return (
		<header class={styles.header}>
			<nav class={styles.navbarGrow}>
				<ul class={styles.navbar}>
					<li>
						<NavLink class={styles.navbarBrand} href="/">
							Open Bible
						</NavLink>
					</li>
				</ul>
			</nav>
			<div style={{ display: 'flex' }}>
				<ul class={styles.navbar}>
					<li><NavLink href="/about">About</NavLink></li>
					<li><NavLink href="/settings">Settings</NavLink></li>
				</ul>
				<form class={styles.form}>
					{/*<input placeholder="Search"></input>*/}
				</form>
			</div>
		</header>
	);
}
