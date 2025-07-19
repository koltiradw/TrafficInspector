import React, { useState } from "react";
import { useSearchParams } from "wouter";

import {
	gridPageCountSelector,
	gridPageSelector,
	gridPageSizeSelector,
	useGridApiContext,
	useGridSelector,
} from "@mui/x-data-grid";

import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import Pagination from "@mui/material/Pagination";
import FormControl from "@mui/material/FormControl";

import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";

import { $ui } from "@shared";

import FilterWizard, { type FilterWizardProps } from "./filter-wizard";
import type { Filter } from "../../model";

export default function CustomFooter(props: any) {
	const [searchParams, setSearchParams] = useSearchParams();
	const activeFilter = searchParams.get("filterID");

	const [filters, setFilters] = useState<Filter[]>([]);

	const apiRef = useGridApiContext();

	const page = useGridSelector(apiRef, gridPageSelector);
	const pageCount = useGridSelector(apiRef, gridPageCountSelector);
	const pageSize = useGridSelector(apiRef, gridPageSizeSelector);

	const [showFilterOverlay, setShowFilterOverlay] = useState(false);

	const selectFilter = (id: Filter["id"]) => {
		searchParams.set("filterID", id);
		setSearchParams(searchParams);
	};

	const saveFilter: FilterWizardProps["onSave"] = (filter, apply) => {
		// post i suppose
		setFilters((current) => [...current, filter]);

		if (apply) {
			selectFilter(filter.id);
		}

		setShowFilterOverlay(false);
	};

	const removeFilter = (del?: true) => {
		searchParams.delete("filterID");
		setSearchParams(searchParams);

		if (del) {
			setFilters((current) => current.filter((f) => f.id !== activeFilter));
		}
	};

	return (
		<div
			style={{
				width: "100%",
				display: "inline-flex",
				justifyContent: "space-between",
				gap: "1rem",
				paddingInline: "1rem",
				height: "100%",
				alignItems: "center",
			}}
		>
			<div style={{ display: "inline-flex", alignItems: "center", gap: "1rem" }}>
				<Button startIcon={<AddIcon />} variant='outlined' onClick={() => setShowFilterOverlay(true)}>
					Create filter
				</Button>
				<FormControl fullWidth sx={{ flex: "0 0 180px " }}>
					<InputLabel id='select-filter-label'>Choose filter</InputLabel>
					<Select
						value={activeFilter ?? undefined}
						defaultValue='Choose filter'
						id='select-filter'
						labelId='select-filter-label'
						onChange={(event) => selectFilter(event.target.value)}
					>
						{filters.map((filter) => (
							<MenuItem value={filter.id}>{filter.name}</MenuItem>
						))}
					</Select>
				</FormControl>
				<Button
					startIcon={<EditIcon />}
					variant='outlined'
					disabled={activeFilter === null}
					onClick={() => removeFilter()}
				>
					Remove filter
				</Button>
				<Button
					startIcon={<EditIcon />}
					onClick={() => setShowFilterOverlay(true)}
					variant='outlined'
					disabled={activeFilter === null}
				>
					Edit filter
				</Button>
				<Button
					startIcon={<EditIcon />}
					variant='outlined'
					disabled={activeFilter === null}
					onClick={() => removeFilter(true)}
				>
					Delete filter
				</Button>
			</div>
			<Pagination
				variant='outlined'
				shape='rounded'
				showFirstButton
				showLastButton
				color='primary'
				count={pageCount}
				page={page + 1}
				onChange={(event, value) => apiRef.current.setPage(value - 1)}
			/>
			<$ui.overlay show={showFilterOverlay} onBack={() => setShowFilterOverlay(false)} width={45}>
				<FilterWizard filter={null} onClose={() => setShowFilterOverlay(false)} onSave={saveFilter} />
			</$ui.overlay>
		</div>
	);
}
