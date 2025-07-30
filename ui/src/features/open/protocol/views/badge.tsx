import React from "react";
import type { FC } from "react";

import Chip from "@mui/material/Chip";

import { $helpers } from "@shared";
import { COLORS } from "@layout/theme";

import { color } from "../helpers";
import type { ENUM } from "../model";

interface Props {
	protocol: ENUM;
}

const Badge: FC<Props> = ({ protocol }) => (
	<Chip
		label={protocol}
		sx={{
			backgroundColor: color[protocol] ?? COLORS.accent,
			color: $helpers.style.isColorLight(color[protocol] ?? COLORS.accent) ? "#333333" : "#FAF0E6",
			fontWeight: "bold",
		}}
	/>
);

export default Badge;
