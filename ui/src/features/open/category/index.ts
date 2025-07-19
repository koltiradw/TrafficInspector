import Top from "./views/top";
import Badge from "./views/badge";
import Select from "./views/select";

import list from "./list";

import type { ENUM } from "./model";

export default {
	list,
	view: {
		badge: Badge,
		select: Select,
		chart: {
			top: Top,
		},
	},
};

export interface Model {
	enum: ENUM;
}
