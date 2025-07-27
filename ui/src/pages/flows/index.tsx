import React from "react";

import { useSearchParams } from "wouter";

import { $ui } from "@shared";
import { $features } from "@features";

import PageWrapper from "@layout/page";

const Page = () => {
	const [searchParams, setSearchParams] = useSearchParams();

	const flowID = searchParams.get("id");

	const closeOverlay = () => {
		searchParams.delete("id");
		setSearchParams(searchParams);
	};

	return (
		<PageWrapper paddingBlock='xl' style={{ overflowX: "hidden" }}>
			<$features.closed.flow.view.table />

			<$ui.overlay show={flowID !== null} onBack={closeOverlay}>
				<PageWrapper paddingBlock='xl'>
					<$features.closed.flow.view.info flow_id={flowID} />
				</PageWrapper>
			</$ui.overlay>
		</PageWrapper>
	);
};

export default Page;
