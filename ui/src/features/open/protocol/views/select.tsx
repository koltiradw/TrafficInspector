import React from "react";

import Select, { type SelectProps } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";

import list from "../list";
import type { ENUM } from "../model";

export default function ProtocolSelect(props: SelectProps<ENUM>) {
	return (
		<Select {...props}>
			{list.map((item) => (
				<MenuItem value={item}>{item}</MenuItem>
			))}
		</Select>
	);
}
