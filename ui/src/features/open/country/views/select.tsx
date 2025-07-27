import React from "react";

import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectProps } from "@mui/material/Select";

import Flag from "./flag";
import list from "../list";

import type { ENUM } from "../model";

// TODO: there is like 250 requests when opening the select for the 1st time ...
// https://github.com/bvaughn/react-window
// https://mui.com/material-ui/react-autocomplete/#custom-filter
export default function CountrySelect(props: SelectProps<ENUM>) {
	return (
		<Select {...props}>
			{list.map((item) => (
				<MenuItem value={item}>
					<Flag code={item} size='sm' />
				</MenuItem>
			))}
		</Select>
	);
}
