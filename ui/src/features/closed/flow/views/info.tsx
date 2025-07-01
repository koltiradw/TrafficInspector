import React, { useEffect, useState } from "react";
import type { FC } from "react";

import Typography from "@mui/material/Typography";

import { $ui } from "@shared";
import { $features } from "@features";
import type { Defined } from "@shared/helpers/types";

import { getFlow } from "../endpoint/query";
import { TcpIpLayers } from "../ui/tcp-ip-layers";
import { ByteRatioBar } from "../ui/byte-ratio-bar";

import type { Flow, FlowDetailed } from "../model";

interface Props {
	flow_id: Flow["id"] | null;
}

const Info: FC<Props> = ({ flow_id }) => {
	const [data, setData] = useState<FlowDetailed | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const doFetch = async (id: Defined<Props["flow_id"]>, signal: AbortSignal) => {
		setIsLoading(true);
		const res = await getFlow(id, signal);
		setIsLoading(false);

		if (res.ok) {
			setError(null);
			setData(res.data);
		} else {
			setData(null);
			setError(res.error);
		}
	};

	useEffect(() => {
		let ctrl: AbortController;

		if (flow_id !== null) {
			// при смене flow_id на undefined будет продолжать отображаться инфо о последнем флоу
			ctrl = new AbortController();
			doFetch(flow_id, ctrl.signal);
		}

		return () => {
			if (ctrl !== undefined) {
				ctrl.abort();
			}
		};
	}, [flow_id]);

	return (
		<>
			{isLoading && <$ui.loader size={52} thickness={3} />}
			{!isLoading && error !== null && (
				<Typography align='center' gutterBottom variant='error' display='block'>
					{error}
				</Typography>
			)}
			{!isLoading && error === null && data !== null && (
				<div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", paddingBottom: "1.5rem" }}>
					<ByteRatioBar source={data.src_len_pkts} destination={data.dst_len_pkts} />

					<TcpIpLayers flow={data} />

					<$features.open.protocol.view.info.full
						details={{
							breed: data.ndpi.breed,
							proto: data.ndpi.proto,
							category: data.ndpi.category,
							hostname: data.ndpi.hostname,
							domainame: data.ndpi.domainame,
							encrypted: data.ndpi.encrypted,
							confidence: data.ndpi.confidence,
						}}
					/>

					{data.ndpi.tls && <$features.open.protocol.view.info.tls details={data.ndpi.tls} />}

					{data.ndpi.dns && <$features.open.protocol.view.info.dns details={data.ndpi.dns} />}
				</div>
			)}
		</>
	);
};

export default Info;

