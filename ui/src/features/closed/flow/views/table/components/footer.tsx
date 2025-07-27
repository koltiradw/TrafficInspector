import React, { useEffect, useState } from "react";
import { useSearchParams } from "wouter";

import { gridPageCountSelector, gridPageSelector, useGridApiContext, useGridSelector } from "@mui/x-data-grid";

import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Skeleton from "@mui/material/Skeleton";
import InputLabel from "@mui/material/InputLabel";
import Pagination from "@mui/material/Pagination";
import FormControl from "@mui/material/FormControl";

import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import BackspaceIcon from "@mui/icons-material/Backspace";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

import { $ui, $hooks } from "@shared";

import FilterWizard, { type FilterWizardProps } from "./filter-wizard";
import type { Filter } from "../../../model";
import { deleteFilter, getFilters } from "@features/closed/flow/endpoint/query";
import { Typography } from "@mui/material";

export default function CustomFooter() {
	const [searchParams, setSearchParams] = useSearchParams();
	const activeFilter = searchParams.get("filterID");

	const { data: filtersData, isLoading, error } = $hooks.useFetch(getFilters, [], { defaultValue: [] });

	const [filters, setFilters] = useState<Filter[]>([]);

	const apiRef = useGridApiContext();

	const page = useGridSelector(apiRef, gridPageSelector);
	const pageCount = useGridSelector(apiRef, gridPageCountSelector);

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
			deleteFilter(activeFilter!);
		}
	};

	useEffect(() => {
		setFilters(filtersData as typeof filters);
	}, [filtersData]);

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
			<div style={{ display: "inline-flex", alignItems: "center", gap: "1rem", height: "100%" }}>
				<Button startIcon={<AddIcon />} variant='outlined' onClick={() => setShowFilterOverlay(true)}>
					Create filter
				</Button>

				{isLoading && <Skeleton animation='wave' variant='rounded' width={180} height={48} />}

				{!isLoading && (
					<FormControl fullWidth sx={{ flex: "0 0 180px ", height: "100%", marginTop: "16px" }}>
						<InputLabel color={error ? "error" : undefined} id='select-filter-label'>
							{error && (
								<Typography
									color='error'
									sx={{ maxWidth: "100%", whiteSpace: "nowrap", textOverflow: "ellipsis", display: "block" }}
								>
									{error}
								</Typography>
							)}
							{!error && "Choose a filter"}
						</InputLabel>
						<Select
							value={activeFilter ?? undefined}
							label={error ?? undefined}
							id='select-filter'
							labelId={error === null ? "select-filter-label" : undefined}
							onChange={(event) => selectFilter(event.target.value)}
							disabled={error !== null}
							color={error ? "error" : undefined}
							size='small'
							sx={{
								"& .MuiInputBase-input": {
									padding: "8px 14px",
								},
								marginTop: "8px",
							}}
						>
							{filters.map((filter) => (
								<MenuItem value={filter.id}>{filter.name}</MenuItem>
							))}
						</Select>
					</FormControl>
				)}

				<Button
					startIcon={<BackspaceIcon />}
					variant='outlined'
					disabled={activeFilter === null}
					onClick={() => removeFilter()}
				>
					Remove
				</Button>
				<Button
					startIcon={<EditIcon />}
					onClick={() => setShowFilterOverlay(true)}
					variant='outlined'
					disabled={activeFilter === null}
				>
					Edit
				</Button>
				<Button
					startIcon={<DeleteForeverIcon />}
					variant='outlined'
					disabled={activeFilter === null}
					onClick={() => removeFilter(true)}
				>
					Delete
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
