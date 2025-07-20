import React from "react";

import { $features } from "@features";
import PageWrapper from "@layout/page";

import styles from "./styles.module.css";

const Dashboard = () => {
	return (
		<PageWrapper heading='Dashboard'>
			<div className={styles["grid-layout"]}>
				<div id='total' style={{ gridRow: "span 2" }} className={styles.tile}>
					<$features.closed.flow.view.total size='xl' />
				</div>

				<div style={{ gridColumn: "span 3", gridRow: "span 2" }} className={styles.tile}>
					<$features.closed.flow.view.chart.totalOverTime />
				</div>
				<div id='ip' style={{ gridColumn: "span 2", gridRow: "span 2" }} className={styles.tile}>
					<$features.open.ip.view.chart.top />
				</div>

				<div id='protocols' style={{ gridRow: "span 2" }} className={styles.tile}>
					<$features.open.protocol.view.chart.top />
				</div>

				<div id='countries' style={{ gridRow: "span 2" }} className={styles.tile}>
					<$features.open.country.view.chart.top />
				</div>

				<div id='categories' style={{ gridRow: "span 2" }} className={styles.tile}>
					<$features.open.category.view.chart.top />
				</div>

				<div id='asn' style={{ gridRow: "span 2" }} className={styles.tile}>
					<$features.open.asn.view.chart.top />
				</div>
				<div id='os' style={{ gridRow: "span 2" }} className={styles.tile}>
					<$features.open.os.view.chart.top />
				</div>
				<div id='l4' style={{ gridRow: "span 2" }} className={styles.tile}>
					<$features.open.protocol.view.chart.topl4 />
				</div>
			</div>
		</PageWrapper>
	);
};

export default Dashboard;
