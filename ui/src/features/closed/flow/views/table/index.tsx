import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "wouter";

import { DataGrid, DataGridProps } from "@mui/x-data-grid";

import Toolbar from "./toolbar";
import Pagination from "./footer";
import { CONFIG } from "./config";

import { getList, type TablePagination } from "../../endpoint/query";

import type { Flow } from "../../model";

const defaultPagination = {
	current_page: 1,
	limit: 25,
	total_flows: 1,
	total_pages: 1,
	next_page: 1,
};

const AUTO_UPDATE_INTERVAL = 30; // in seconds

// TODO: virtualization > pagination?; btn for auto-update?
const Table = () => {
	const [searchParams, setSearchParams] = useSearchParams();

	const currentPage = Number(searchParams.get("page") ?? defaultPagination.current_page);
	const limit = Number(searchParams.get("limit") ?? defaultPagination.limit);
	const flowID = searchParams.get("id");
	const filterID = searchParams.get("filterID");

	const [flows, setFlows] = useState<Flow[]>([]);

	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isAuto, setIsAuto] = useState(false);

	const currentReqController = useRef<AbortController | null>(null);
	const autoInterval = useRef<NodeJS.Timeout>(undefined);

	const pagination = useRef<TablePagination>(defaultPagination);

	const startAuto = () => {
		setIsAuto(true);
	};

	const stopAuto = () => {
		setIsAuto(false);
	};

	const manualUpdate = () => {
		currentReqController.current?.abort();
		autoInterval.current && clearInterval(autoInterval.current);

		doFetch().then(() => handleAuto());
	};

	const handleAuto = () => {
		autoInterval.current = setInterval(() => {
			doFetch();
		}, AUTO_UPDATE_INTERVAL * 1000);
	};

	const doFetch = async () => {
		setIsLoading(true);
		currentReqController.current = new AbortController();
		const res = await getList(currentPage, limit, currentReqController.current?.signal);
		setIsLoading(false);

		if (res.ok) {
			setError(null);
			setFlows(res.data.data);
			pagination.current = res.data.pagination;
		} else {
			setError(res.error);
			setFlows([]);
			pagination.current = defaultPagination;
		}
	};

	useEffect(() => {
		if (flowID === null && isAuto) {
			handleAuto();
		}

		return () => {
			if (flowID !== null) {
				clearInterval(autoInterval.current);
				currentReqController.current?.abort();
			}
		};
	}, [isAuto, currentPage, limit, flowID]);

	useLayoutEffect(() => {
		if (flowID === null) {
			doFetch();
		}

		return () => {
			currentReqController.current?.abort();
		};
	}, []);

	const handleRowClick: DataGridProps<Flow>["onRowClick"] = (params) => {
		searchParams.append("id", params.row.id);
		setSearchParams(searchParams);
	};

	const handlePagination: DataGridProps<Flow>["onPaginationModelChange"] = (model, details) => {
		setSearchParams({ page: String(model.page + 1), limit: String(model.pageSize) });
	};

	return (
		<DataGrid
			{...CONFIG}
			rows={flows}
			slots={{
				toolbar: () => (
					<Toolbar
						onStartUpdate={startAuto}
						onStopUpdate={stopAuto}
						onManualUpdate={manualUpdate}
						interval={AUTO_UPDATE_INTERVAL}
						updateInProgress={isLoading}
						startCountDown={isAuto}
					/>
				),
				baseLinearProgress: () => null,
				pagination: Pagination,
			}}
			/* pagination */
			rowCount={pagination.current.total_flows}
			pageSizeOptions={[10, 25, 50, 100]}
			paginationMeta={{ hasNextPage: pagination.current.current_page < pagination.current.total_pages }}
			paginationModel={{ page: currentPage - 1, pageSize: limit }}
			onPaginationModelChange={handlePagination}
			/* configuration */

			initialState={{
				pagination: {
					rowCount: 0,
					meta: { hasNextPage: false },
					paginationModel: { page: 0, pageSize: defaultPagination.limit },
				},
			}}
			onRowClick={handleRowClick}
			loading={isLoading}
		/>
	);
};

export default Table;
