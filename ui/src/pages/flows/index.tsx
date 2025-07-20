import React from "react";
import type { ReactNode } from "react";

import UndoIcon from "@mui/icons-material/Undo";

import { useLocation, useParams } from "wouter";

import { $ui } from "@shared";
import { $features } from "@features";

import PageWrapper from "@layout/page";
import { Button, IconButton } from "@mui/material";

const Page = () => {
	const { id: flowID } = useParams();
	const [_, navigate] = useLocation();

	let heading: ReactNode;

	if (flowID === undefined) {
		heading = "Network Flows";
	} else {
		heading = (
			<>
				Network Flows {"\u2192"} Flow Info ({flowID}) &nbsp;
				<IconButton onClick={() => navigate("/flows")} aria-label='Go back' size='large' color='primary'>
					<UndoIcon fontSize='large' />
				</IconButton>
			</>
		);
	}

	return (
		<PageWrapper heading={heading} style={{ overflowX: "hidden" }}>
			{/* FIXME: remove */}
			<Button size='large' color='primary' onClick={() => navigate("/flows/1")}>
				dev only: Открыть Flow Info
			</Button>
			<$features.closed.flow.view.table />
			<$ui.overlay show={flowID !== undefined}>
				<$features.closed.flow.view.info flow_id={flowID} />
			</$ui.overlay>
		</PageWrapper>
	);
};

export default Page;
