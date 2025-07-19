import React from "react";
import type { ComponentProps, FC, PropsWithChildren } from "react";

import clsx from "@shared/helpers/clsx";

import styles from "./styles.module.css";

type Props = PropsWithChildren<ComponentProps<"div">> & {
	classNames?: {
		overlay?: string;
		mask?: string;
	};
	width?: number; // in %
	show: boolean;
	onBack: VoidFunction;
};

const Overlay: FC<Props> = ({ show, children, classNames = {}, onBack, width, ...props }) => (
	<div className={clsx(styles["overlay-wrapper"], show && styles.show)}>
		<div
			className={clsx(styles["overlay-mask"], classNames.mask)}
			style={{ flex: width !== undefined ? `${100 - width}%` : undefined }}
			onClick={() => onBack()}
		/>
		<div
			{...props}
			style={{ ...props.style, flex: width ?? props.style?.flex }}
			className={clsx(styles.overlay, show && styles.show, classNames.overlay)}
		>
			{children}
		</div>
	</div>
);

export default Overlay;
