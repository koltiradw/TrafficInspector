import React from "react";
import type { FC, PropsWithChildren } from "react";

import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";

const PageHeader: FC<PropsWithChildren> = ({ children }) => (
	<Typography variant='pageHeader' sx={{ position: "relative", width: "100%", paddingInline: "4rem", height: "4rem" }}>
		{children}
		<Divider
			sx={{
				marginBlockStart: "1rem",
			}}
		/>
	</Typography>
);

export default PageHeader;

