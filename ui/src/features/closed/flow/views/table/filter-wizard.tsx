import React, { type CSSProperties, useEffect, useState } from "react";

import IconButton from "@mui/material/IconButton";
import DoubleArrowIcon from "@mui/icons-material/DoubleArrow";

import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import InputLabel from "@mui/material/InputLabel";
import Typography from "@mui/material/Typography";
import FormControl from "@mui/material/FormControl";

import { $features, type Features } from "@features";

import type { Filter } from "../../model";

interface Props {
	filter: Filter | null; // null for "create" mode
	onSave: (filter: Filter, apply: boolean) => void;
	onClose: VoidFunction;
	className?: string;
	style?: CSSProperties;
}

export default function FilterWizard({ filter, className, style, onClose, onSave }: Props) {
	const [name, setName] = useState<string | undefined>(undefined);
	const [category, setCategory] = useState<Features["open"]["category"]["enum"] | undefined>(undefined);
	const [protocol, setProtocol] = useState<Features["open"]["protocol"]["enum"] | undefined>(undefined);
	const [srcCountry, setSrcCountry] = useState<Features["open"]["country"]["enum"] | undefined>(undefined);
	const [dstCountry, setDstCountry] = useState<Features["open"]["country"]["enum"] | undefined>(undefined);
	const [srcIP, setSrcIP] = useState<string | undefined>(undefined);
	const [dstIP, setDstIP] = useState<string | undefined>(undefined);
	const [srcPort, setSrcPort] = useState<number | undefined>(undefined);
	const [dstPort, setDstPort] = useState<number | undefined>(undefined);

	useEffect(() => {
		// 🤡
		if (filter === null) {
			setName("New filter");
			setCategory(undefined);
			setProtocol(undefined);
			setSrcCountry(undefined);
			setDstCountry(undefined);
			setSrcIP(undefined);
			setDstIP(undefined);
			setSrcPort(undefined);
			setDstPort(undefined);
		} else {
			setCategory(filter.body.category as typeof category);
			setProtocol(filter.body.protocol as typeof protocol);
			setSrcCountry(filter.body.src_country as typeof srcCountry);
			setDstCountry(filter.body.dst_country as typeof dstCountry);
			setSrcIP(filter.body.src_ip as string);
			setDstIP(filter.body.dst_ip as string);
			setSrcPort(filter.body.src_port as number);
			setDstPort(filter.body.dst_port as number);
		}
	}, [filter]);

	const getFilterBody = () => ({
		id: filter?.id ?? String(new Date().valueOf()),
		name: name!,
		body: {
			category,
			protocol,
			src_country: srcCountry,
			dst_country: dstCountry,
			src_ip: srcIP,
			dst_ip: dstIP,
			src_port: srcPort,
			dst_port: dstPort,
		},
	});

	const save = () => {
		onSave(getFilterBody(), false);
	};

	const apply = () => {
		onSave(getFilterBody(), true);
	};

	return (
		<div
			style={{
				...style,
				display: "flex",
				flexDirection: "column",
				height: "100%",
				maxHeight: "100%",
				overflow: "hidden",
			}}
		>
			<div
				style={{
					flex: "0 0 3rem",
					display: "inline-flex",
					justifyContent: "space-between",
					alignItems: "center",
					paddingInline: "1.5rem",
					height: "3rem",
					maxHeight: "100%",
					overflowX: "hidden",
					overflowY: "auto",
				}}
			>
				<IconButton onClick={onClose} color='primary' sx={{ paddingLeft: "0" }}>
					<DoubleArrowIcon />
				</IconButton>

				<Typography variant='tableHeader'>{name ?? "New filter"}</Typography>
			</div>

			<Divider />

			<div
				style={{
					flex: "1 1 auto",
					display: "flex",
					flexDirection: "column",
					alignItems: "flex-start",
					justifyContent: "flex-start",
					gap: "1rem",
					padding: "1rem",
				}}
			>
				<FormControl fullWidth size='small'>
					<InputLabel id='form-destination-port-label'>Name</InputLabel>
					<TextField size='small' onChange={(e) => setName(e.target.value)} value={name} />
				</FormControl>
				<FormControl fullWidth size='small'>
					<InputLabel id='form-category-label'>Category</InputLabel>
					<$features.open.category.view.select
						autoWidth={false}
						multiple={false}
						native={false}
						value={category}
						onChange={(e) => setCategory(e.target.value as typeof category)}
					/>
				</FormControl>
				<FormControl fullWidth size='small'>
					<InputLabel id='form-protocol-label'>Protocol</InputLabel>
					<$features.open.protocol.view.select
						autoWidth={false}
						multiple={false}
						native={false}
						value={protocol}
						onChange={(e) => setProtocol(e.target.value as typeof protocol)}
					/>
				</FormControl>
				<FormControl fullWidth size='small'>
					<InputLabel id='form-source-country-label'>Source country</InputLabel>
					<$features.open.country.view.select
						autoWidth={false}
						multiple={false}
						native={false}
						value={srcCountry}
						onChange={(e) => setSrcCountry(e.target.value as typeof srcCountry)}
					/>
				</FormControl>
				<FormControl fullWidth size='small'>
					<InputLabel id='form-destination-country-label'>Desination country</InputLabel>
					<$features.open.country.view.select
						autoWidth={false}
						multiple={false}
						native={false}
						value={dstCountry}
						onChange={(e) => setDstCountry(e.target.value as typeof dstCountry)}
					/>
				</FormControl>
				<FormControl fullWidth size='small'>
					<InputLabel id='form-source-ip-label'>Source IP</InputLabel>
					<$features.open.ip.view.input value={srcIP} onChange={(e) => setSrcIP(e.target.value)} size='small' />
				</FormControl>
				<FormControl fullWidth size='small'>
					<InputLabel id='form-destination-ip-label'>Desination IP</InputLabel>
					<$features.open.ip.view.input value={dstIP} onChange={(e) => setDstIP(e.target.value)} size='small' />
				</FormControl>
				<FormControl fullWidth size='small'>
					<InputLabel id='form-source-port-label'>Source port</InputLabel>
					<TextField type='number' size='small' value={srcPort} onChange={(e) => setSrcPort(Number(e.target.value))} />
					{/* <$features.open.ip.view.input onChange={(e) => console.log(e.target.value)} /> */}
				</FormControl>
				<FormControl fullWidth size='small'>
					<InputLabel id='form-destination-port-label'>Desination port</InputLabel>
					<TextField type='number' size='small' value={dstPort} onChange={(e) => setDstPort(Number(e.target.value))} />
				</FormControl>
			</div>
			<Divider />
			<div
				style={{
					flex: "0 0 3rem",
					display: "inline-flex",
					justifyContent: "flex-start",
					alignItems: "center",
					paddingInline: "1.5rem",
					height: "3rem",
					gap: "1rem",
				}}
			>
				<Button variant='contained' onClick={save}>
					Save
				</Button>
				<Button variant='outlined' onClick={apply}>
					Save and apply
				</Button>
				<Button variant='text' onClick={onClose}>
					Cancel
				</Button>
			</div>
		</div>
	);
}

export type FilterWizardProps = Props;
