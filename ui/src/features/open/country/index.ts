import Top from "./views/top";
import Flag from "./views/flag";
import Select from "./views/select";

import list from "./list";
import type { ENUM } from "./model";

export default {
	list,
	view: {
		select: Select,
		flag: Flag,
		chart: {
			top: Top,
		},
	},
};

export interface Model {
	enum: ENUM;
}
