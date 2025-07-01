import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "wouter";

import Typography from "@mui/material/Typography";
import { DataGrid, DataGridProps, GridColDef } from "@mui/x-data-grid";

import { $features } from "@features";

import { getList, type TablePagination } from "../../endpoint/query";
import type { Flow } from "../../model";

import Toolbar from "./toolbar";

const columns: GridColDef<Flow>[] = [
	{
		field: "id",
		headerName: "ID",
		headerAlign: "center",
		align: "center",
		flex: 1,
		minWidth: 50,
		maxWidth: 100,
	},
	{
		field: "last_seen",
		headerName: "Last seen",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 100,
	},
	{
		field: "src_ip",
		headerName: "Source",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 100,
		display: "flex",
		renderCell: (params) => (
			<div
				style={{
					display: "inline-flex",
					justifyContent: "center",
					alignItems: "center",
					gap: "0.4rem",
				}}
			>
				<$features.open.country.view.flag code={params.row.src_country} size='sm' />
				<Typography variant='tableCell'>
					{params.row.src_ip}:{params.row.src_port}
				</Typography>
			</div>
		),
	},
	{
		field: "dest_ip",
		headerName: "Destination",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 100,
		display: "flex",
		renderCell: (params) => (
			<div
				style={{
					display: "inline-flex",
					justifyContent: "center",
					alignItems: "center",
					gap: "0.4rem",
				}}
			>
				<$features.open.country.view.flag code={params.row.dst_country} size='sm' />
				<Typography variant='tableCell'>
					{params.row.dst_ip}:{params.row.dst_port}
				</Typography>
			</div>
		),
	},
	{
		field: "protocol",
		headerName: "Protocol",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 100,
	},
	{
		field: "category",
		headerName: "Category",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 100,
		renderCell: (params) => <$features.open.category.view.badge category={params.row.category} />,
	},
];

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
			}}
			sx={{
				"& .MuiDataGrid-columnHeader": {
					pointerEvents: "none",
					outline: "none",
					fontSize: "1.2rem",
				},
				"& .MuiDataGrid-cell:not(:nth-of-type(2))": {
					cursor: "pointer",
					paddingLeft: "2.5rem",
				},
				"& .MuiDataGrid-cell:focus": {
					outline: "none",
				},
				"& .MuiDataGrid-row:hover": {
					backgroundColor: "hsla(248, 46%, 60%, 0.6)",
				},
				"& .MuiDataGrid-row:nth-of-type(odd)": {
					backgroundColor: "var(--off-bg)",
				},
				"& .MuiDataGrid-row:nth-of-type(odd):hover": {
					backgroundColor: "hsla(248, 46%, 60%, 0.6)",
				},
			}}
			/* data */
			columns={columns}
			rows={flows}
			/* pagination */
			rowCount={pagination.current.total_flows}
			pagination
			paginationMode='server'
			pageSizeOptions={[10, 25, 50, 100]}
			paginationMeta={{ hasNextPage: pagination.current.current_page < pagination.current.total_pages }}
			paginationModel={{ page: currentPage - 1, pageSize: limit }}
			onPaginationModelChange={handlePagination}
			/* configuration */
			disableColumnResize
			autosizeOnMount
			autosizeOptions={{ expand: true, disableColumnVirtualization: true, includeHeaders: true }}
			density='comfortable'
			initialState={{
				pagination: {
					rowCount: 0,
					meta: { hasNextPage: false },
					paginationModel: { page: 0, pageSize: defaultPagination.limit },
				},
			}}
			disableAutosize
			disableColumnFilter
			disableColumnMenu
			disableColumnSelector
			disableColumnSorting
			disableDensitySelector
			disableRowSelectionOnClick
			disableMultipleRowSelection
			disableVirtualization
			showToolbar
			label='Network Flows'
			onRowClick={handleRowClick}
			rowSelection={false}
			loading={isLoading}
			rowHeight={undefined}
			rowSpacingType='border'
			sortingMode='server'
		/>
	);
};

export default Table;
