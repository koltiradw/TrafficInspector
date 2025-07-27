import React from "react";
import type { ComponentProps, FC, PropsWithChildren } from "react";

import { $helpers, $ui } from "@shared";

import styles from "./styles.module.css";

type Props = PropsWithChildren<ComponentProps<"div">> & {
	paddingBlock?: "default" | "sm" | "xl";
};

const Page: FC<Props> = ({ paddingBlock = "default", className, children, ...props }) => (
	<$ui.scrollable {...props} className={$helpers.clsx(className, styles["page-container"])}>
		<div className={$helpers.clsx(styles["page-content-wrapper"], styles[paddingBlock])}>{children}</div>
	</$ui.scrollable>
);

export default Page;
