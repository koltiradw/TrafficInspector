import React, { useState, useRef, useEffect } from "react";

import { Toolbar } from "@mui/x-data-grid";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";

import UpdateOutlinedIcon from "@mui/icons-material/UpdateOutlined";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";

interface Props {
	onStartUpdate: VoidFunction;
	onStopUpdate: VoidFunction;
	onManualUpdate: VoidFunction;
	interval: number;
	updateInProgress: boolean;
	startCountDown: boolean;
}

export default function CustomToolbar({
	onStartUpdate,
	onStopUpdate,
	onManualUpdate,
	updateInProgress,
	startCountDown,
	interval,
}: Props) {
	const [timeLeft, setTimeLeft] = useState(interval);
	const timerRef = useRef<NodeJS.Timeout>(undefined);

	useEffect(() => {
		if (startCountDown && !updateInProgress) {
			setTimeLeft(interval);
			timerRef.current = setInterval(() => {
				setTimeLeft((current) => current - 1);
			}, 1000);
		}

		return () => {
			clearInterval(timerRef.current);
			setTimeLeft(interval);
		};
	}, [startCountDown, updateInProgress, interval]);

	const progress = ((interval - timeLeft) / interval) * 100;

	return (
		<Toolbar>
			<Box width='100%' display='flex' alignItems='center' justifyContent='space-between' paddingInline={1} gap={4}>
				<Box display='flex' alignItems='center' justifyContent='start' gap={2} sx={{ flex: "1 0 auto" }}>
					{startCountDown && (
						<Button
							disabled={updateInProgress}
							variant='contained'
							color='primary'
							startIcon={<UpdateOutlinedIcon />}
							onClick={onStopUpdate}
						>
							Stop auto-update
						</Button>
					)}
					{!startCountDown && (
						<Button
							disabled={updateInProgress}
							variant='outlined'
							color='primary'
							startIcon={<UpdateOutlinedIcon />}
							onClick={onStartUpdate}
						>
							Start auto-update
						</Button>
					)}
					<Button
						disabled={updateInProgress}
						variant='outlined'
						color='primary'
						startIcon={<SystemUpdateAltIcon />}
						onClick={onManualUpdate}
					>
						Update
					</Button>
				</Box>
				<Typography display='block' align='right' fontSize='1rem' fontStyle={updateInProgress ? "normal" : "italic"}>
					{updateInProgress && "Loading..."}
					{!updateInProgress && startCountDown && `Updating in ${timeLeft} seconds`}
				</Typography>
				{(startCountDown || updateInProgress) && (
					<LinearProgress
						sx={{ flex: "1 0 auto" }}
						variant={updateInProgress ? "indeterminate" : "determinate"}
						value={updateInProgress ? undefined : progress}
					/>
				)}
			</Box>
		</Toolbar>
	);
}
