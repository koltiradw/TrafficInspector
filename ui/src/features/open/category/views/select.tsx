import React from "react";

import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectProps } from "@mui/material/Select";

import list from "../list";
import type { ENUM } from "../model";

export default function CategorySelect(props: SelectProps<ENUM>) {
	return (
		<Select {...props}>
			{list.map((item) => (
				<MenuItem value={item}>{item}</MenuItem>
			))}
		</Select>
	);
}
