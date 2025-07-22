import React from "react";
import type { ComponentProps, FC, PropsWithChildren, ReactNode } from "react";

import { $ui } from "@shared";

import styles from "./styles.module.css";
import clsx from "@shared/helpers/clsx";

type Props = PropsWithChildren<ComponentProps<"div">> & {
	heading: ReactNode;
};

const Page: FC<Props> = ({ heading, className, children, ...props }) => (
	<$ui.scrollable {...props} className={clsx(className, styles["page-container"])}>
		{/* <$ui.pageHeader>{heading}</$ui.pageHeader> */}
		<div className={styles["page-content-wrapper"]}>{children}</div>
	</$ui.scrollable>
);

export default Page;

