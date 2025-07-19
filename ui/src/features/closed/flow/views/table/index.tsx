import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "wouter";

import { DataGrid, DataGridProps, GridColDef, GridColumnGroupingModel, GridLeafColumn } from "@mui/x-data-grid";

import { $features } from "@features";

import Toolbar from "./toolbar";
import Pagination from "./footer";
import { getList, type TablePagination } from "../../endpoint/query";

import type { Flow } from "../../model";

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
		field: "protocol",
		headerName: "Protocol",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 100,
	},
	{
		field: "src_country",
		headerName: "Country",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 60,
		renderCell: (params) => <$features.open.country.view.flag code={params.row.src_country} size='sm' />,
	},
	{
		field: "src_ip",
		headerName: "IP",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 100,
		display: "flex",
	},
	{
		field: "src_port",
		headerName: "Port ",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 100,
		display: "flex",
	},
	{
		field: "dst_country",
		headerName: "Country",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 60,
		renderCell: (params) => <$features.open.country.view.flag code={params.row.dst_country} size='sm' />,
	},
	{
		field: "dst_ip",
		headerName: "IP",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 100,
		display: "flex",
	},
	{
		field: "dst_port",
		headerName: "Port ",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 100,
		display: "flex",
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

const columnGroupingModel: GridColumnGroupingModel = [
	{
		groupId: "source",
		headerName: "Source",
		headerAlign: "center",
		children: [{ field: "src_country" }, { field: "src_ip" }, , { field: "src_port" }] as GridLeafColumn[],
	},
	{
		groupId: "destination",
		headerName: "Destination ",
		headerAlign: "center",
		children: [{ field: "dst_country" }, { field: "dst_ip" }, , { field: "dst_port" }] as GridLeafColumn[],
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
				"& .MuiDataGrid-footerContainer": {
					height: "72px",
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
			columnGroupingModel={columnGroupingModel}
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
