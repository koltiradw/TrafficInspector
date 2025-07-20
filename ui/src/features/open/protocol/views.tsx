import React from "react";
import type { FC } from "react";

import { Box, Grid, Typography, Chip } from "@mui/material";
import { Security as SecurityIcon } from "@mui/icons-material";

import { $ui } from "@shared";
import { COLORS } from "@layout/theme";
import type { Features } from "@features";

interface Props {
	details: Pick<
		Features["closed"]["flow"]["detailed"]["ndpi"],
		"breed" | "proto" | "category" | "confidence" | "encrypted" | "hostname" | "domainame"
	>;
}

export const Info: FC<Props> = ({ details }) => (
	<Box
		sx={{
			display: "flex",
			flexDirection: "column",
			alignItems: "flex-start",
			gap: 2.5,
			flexWrap: "wrap",
			padding: 3,
			borderRadius: "8px",
			border: "1px solid var(--disabled)",
		}}
	>
		<$ui.blockHeader icon={SecurityIcon} title='Protocol Analysis' />

		<Grid
			container
			spacing={2}
			style={{
				width: "100%",
				display: "grid",
				gridTemplateColumns: "repeat(7, 1fr)",
			}}
		>
			{/* Encrypted */}
			<div
				style={{
					display: "inline-flex",
					flexDirection: "column",
					gap: "1.25rem",
				}}
			>
				<Typography style={{ alignSelf: "start" }} variant='baseXl'>
					Encrypted
				</Typography>
				<Chip
					label={details.encrypted ? "Yes" : "No"}
					size='small'
					color={details.encrypted ? "success" : "error"}
					style={{
						alignSelf: "start",
						width: "fit-content",
						paddingInline: "1rem",
					}}
				/>
			</div>

			{/* Protocol */}
			<div
				style={{
					display: "inline-flex",
					flexDirection: "column",
					gap: "1.25rem",
				}}
			>
				<Typography style={{ alignSelf: "start" }} variant='baseXl'>
					Protocol
				</Typography>
				<Chip
					label={details.proto}
					size='small'
					color={details.proto === "Unknown" ? "error" : "primary"}
					style={{
						alignSelf: "start",
						paddingInline: "1.25rem",
						width: "fit-content",
						backgroundColor: details.proto === "Unknown" ? COLORS.error : undefined,
						color: COLORS.white,
					}}
				/>
			</div>

			{/* Breed */}
			<div
				style={{
					display: "inline-flex",
					flexDirection: "column",
					gap: "1.25rem",
				}}
			>
				<Typography style={{ alignSelf: "start" }} variant='baseXl'>
					Breed
				</Typography>
				<Typography
					variant='base'
					noWrap
					style={{
						alignSelf: "start",
						paddingInline: "1.25rem",
						height: "100%",
					}}
				>
					{details.breed}
				</Typography>
			</div>

			{/* Category */}
			<div
				style={{
					display: "inline-flex",
					flexDirection: "column",
					gap: "1.25rem",
				}}
			>
				<Typography style={{ alignSelf: "start" }} variant='baseXl'>
					Category
				</Typography>
				<Typography
					variant='base'
					noWrap
					style={{
						alignSelf: "start",
						paddingInline: "1.25rem",
						height: "100%",
					}}
				>
					{details.category}
				</Typography>
			</div>

			{/* Confidence */}
			<div
				style={{
					display: "inline-flex",
					flexDirection: "column",
					gap: "1.25rem",
				}}
			>
				<Typography style={{ alignSelf: "start" }} variant='baseXl'>
					Confidence
				</Typography>
				<Typography
					variant='base'
					noWrap
					style={{
						alignSelf: "start",
						paddingInline: "1.25rem",
						height: "100%",
					}}
				>
					{details.confidence === undefined ? "-" : Object.values(details.confidence)[0]}
				</Typography>
			</div>

			{/* Hostname */}
			<div
				style={{
					display: "inline-flex",
					flexDirection: "column",
					gap: "1.25rem",
				}}
			>
				<Typography style={{ alignSelf: "start" }} variant='baseXl'>
					Hostname
				</Typography>
				<Typography
					variant='base'
					noWrap
					style={{
						alignSelf: "start",
						paddingInline: "1.25rem",
						height: "100%",
						alignContent: "center",
					}}
				>
					{details.hostname === undefined ? "-" : details.hostname}
				</Typography>
			</div>

			{/* Domain */}
			<div
				style={{
					display: "inline-flex",
					flexDirection: "column",
					gap: "1.25rem",
				}}
			>
				<Typography style={{ alignSelf: "start" }} variant='baseXl'>
					Domain
				</Typography>
				<Typography
					variant='base'
					noWrap
					style={{
						alignSelf: "start",
						paddingInline: "1.25rem",
						height: "100%",
						alignContent: "center",
					}}
				>
					{details.domainame === undefined ? "-" : details.domainame}
				</Typography>
			</div>
		</Grid>
	</Box>
);
