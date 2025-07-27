import React from "react";
import type { FC } from "react";

import PageWrapper from "@layout/page";

import { $features } from "@features";
import type { Features } from "@features";

interface Props {
	flow_id: Features["closed"]["flow"]["default"]["id"];
}

const Page: FC<Props> = ({ flow_id }) => (
	<PageWrapper>{flow_id !== undefined && <$features.closed.flow.view.info flow_id={flow_id} />}</PageWrapper>
);

export default Page;

