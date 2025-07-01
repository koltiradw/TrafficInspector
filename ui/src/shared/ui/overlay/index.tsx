import React from "react";
import clsx from "@shared/helpers/clsx";
import type { ComponentProps, FC, PropsWithChildren } from "react";

import styles from "./styles.module.css";

type Props = PropsWithChildren<ComponentProps<"div">> & {
	classNames?: {
		overlay?: string;
		mask?: string;
	};
	show: boolean;
	onBack: VoidFunction;
};

const Overlay: FC<Props> = ({ show, children, classNames = {}, onBack, ...props }) => (
	<div className={clsx(styles["overlay-wrapper"], show && styles.show)}>
		<div className={clsx(styles["overlay-mask"], classNames.mask)} onClick={() => onBack()} />
		<div {...props} className={clsx(styles.overlay, show && styles.show, classNames.overlay)}>
			{children}
		</div>
	</div>

	// <div className={clsx(styles["overlay-mask"], show && styles.show)} onClick={() => onBack()}>
	// 	<div {...props} className={clsx(styles.overlay, show && styles.show, className)}>
	// 		{children}
	// 	</div>
	// </div>
);

export default Overlay;
