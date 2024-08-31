import { A, AnchorProps } from '@solidjs/router';
import Favicon from './icons/favicon.svg';
import styles from './nav.module.css';

const NavLink = (props: Omit<AnchorProps, 'activeClass'>) => (
	<A activeClass="" {...props} />
);

export function Nav() {
	return (
		<nav class={styles.nav}>
			<ul>
				<NavLink href="/" class={styles.brand}>
					<Favicon />
					Home
				</NavLink>
			</ul>
		</nav>
	);
}
