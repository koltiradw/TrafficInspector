import React from "react";
import type { MouseEventHandler } from "react";

import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";

import { COLORS } from "@layout/theme";

import styles from "./styles.module.css";
import { useLocation } from "wouter";

const Navbar = () => {
	const [location, navigate] = useLocation();

	const handleNavigate =
		(route: string): MouseEventHandler<HTMLAnchorElement> =>
		(e) => {
			e.preventDefault();
			navigate(route);
		};

	return (
		<nav className={styles.navbar}>
			<ul className={styles["nav-list"]}>
				<li className={location.startsWith("/dashboard") ? styles.active : undefined}>
					<Link
						href='/dashboard'
						onClick={handleNavigate("/dashboard")}
						variant='navLink'
						underline='none'
						color={COLORS["off-white"]}
					>
						Dashboard
					</Link>
				</li>
				<li className={location.startsWith("/flows") ? styles.active : undefined}>
					<Link
						href='/flows'
						onClick={handleNavigate("/flows")}
						variant='navLink'
						underline='none'
						color={COLORS["off-white"]}
					>
						Flows
					</Link>
				</li>
			</ul>

			<div className={styles["logo-container"]}>
				<Typography variant='navTitle'>Traffic Inspector</Typography>
			</div>
		</nav>
	);
};

export default Navbar;

