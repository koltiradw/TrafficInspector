import React from "react";

import type { DataGridProps, GridColDef, GridColumnGroupingModel, GridLeafColumn } from "@mui/x-data-grid";

import { $features } from "@features";
import type { Features } from "@features";

import styles from "./styles.module.css";

const columns: GridColDef<Features["closed"]["flow"]["default"]>[] = [
	{
		field: "id",
		headerName: "ID",
		headerAlign: "center",
		align: "center",
		flex: 1,
		minWidth: 50,
		maxWidth: 100,
		cellClassName: styles.cell,
	},
	{
		field: "last_seen",
		headerName: "Last seen",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 100,
		cellClassName: styles.cell,
	},
	{
		field: "protocol",
		headerName: "Protocol",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 100,
		cellClassName: styles.cell,
	},
	{
		field: "src_country",
		headerName: "Country",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 60,
		renderCell: (params) => (
			<$features.open.country.view.flag code={params.row.src_country} size='sm' style={{ verticalAlign: "middle" }} />
		),
		cellClassName: styles.cell,
	},
	{
		field: "src_ip",
		headerName: "IP",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 100,
		display: "flex",
		cellClassName: styles.cell,
	},
	{
		field: "src_port",
		headerName: "Port ",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 100,
		display: "flex",
		cellClassName: styles.cell,
	},
	{
		field: "dst_country",
		headerName: "Country",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 60,
		renderCell: (params) => (
			<$features.open.country.view.flag code={params.row.dst_country} size='sm' style={{ verticalAlign: "middle" }} />
		),
		cellClassName: styles.cell,
	},
	{
		field: "dst_ip",
		headerName: "IP",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 100,
		display: "flex",
		cellClassName: styles.cell,
	},
	{
		field: "dst_port",
		headerName: "Port ",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 100,
		display: "flex",
		cellClassName: styles.cell,
	},
	{
		field: "category",
		headerName: "Category",
		headerAlign: "center",
		align: "left",
		flex: 1,
		minWidth: 100,
		cellClassName: styles.cell,
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

export const CONFIG: DataGridProps = {
	columnGroupHeaderHeight: 48,
	sx: {
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
	},
	/* data */
	columns: columns,
	/* pagination */
	pagination: true,
	paginationMode: "server",
	pageSizeOptions: [10, 25, 50, 100],
	/* configuration */
	columnGroupingModel: columnGroupingModel,
	disableColumnResize: true,
	autosizeOnMount: true,
	autosizeOptions: { expand: true, disableColumnVirtualization: true, includeHeaders: true },
	density: "standard",
	disableAutosize: true,
	disableColumnFilter: true,
	disableColumnMenu: true,
	disableColumnSelector: true,
	disableColumnSorting: true,
	disableDensitySelector: true,
	disableRowSelectionOnClick: true,
	disableMultipleRowSelection: true,
	disableVirtualization: true,
	showToolbar: true,
	label: "Network Flows",
	rowSelection: false,
	rowSpacingType: "border",
	sortingMode: "server",
};
