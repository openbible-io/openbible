import { A as Link, AnchorProps as LinkProps } from '@solidjs/router';
import { FavIcon } from '../../icons/index';
import styles from './nav.module.css';

const NavLink = (props: Omit<LinkProps, 'activeClass'>) => (
	<Link activeClass="" {...props} />
);

export function Nav() {
	return (
		<header class={styles.header}>
			<NavLink class={styles.navbarBrand} href="/">
				<FavIcon height="2rem" width="2rem" />
			</NavLink>
			<nav>
				<ul class={styles.navbar}>
					<li><NavLink href="/about">About</NavLink></li>
					<li><NavLink href="/settings">Settings</NavLink></li>
				</ul>
			</nav>
			<form class={styles.form}>
				{/*<input placeholder="Search"></input>*/}
			</form>
		</header>
	);
}
