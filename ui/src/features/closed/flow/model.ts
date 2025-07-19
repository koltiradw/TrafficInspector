import type { Features } from "@features";

export interface Flow {
	id: string;
	last_seen: string;
	src_ip: string;
	dst_ip: string;
	src_port: number;
	dst_port: number;
	src_country: Features["open"]["country"]["enum"];
	dst_country: Features["open"]["country"]["enum"];
	protocol: Features["open"]["protocol"]["enum"];
	category: Features["open"]["category"]["enum"];
}

interface FlowRisk {
	risk: string;
	severity: string;
	risk_score: {
		total: number;
		client: number;
		server: number;
	};
}

export interface FlowDetailed extends Flow {
	src_mac: string;
	dst_mac: string;
	ipv: number;
	tcp_fingerprint: string;
	src_os: string;
	dst_os: string;
	// TODO: proto? Flow['protocol']?
	proto: Features["open"]["protocol"]["enum"];
	src_as: string;
	dst_as: string;
	first_seen: string;
	last_seen: string;
	src_num_pkts: number;
	dst_num_pkts: number;
	src_len_pkts: number;
	dst_len_pkts: number;
	ndpi: {
		tls: Features["open"]["protocol"]["tls"];
		dns: Features["open"]["protocol"]["dns"];
		breed: string;
		proto: string;
		category: string;
		hostname: string;
		proto_id: string;
		domainame: string;
		encrypted: number;
		flow_risk: Record<string, FlowRisk>;
		confidence: Record<string, string>;
		category_id: number;
		proto_by_ip: string;
		proto_by_ip_id: number;
	};
}

export interface Filter {
	name: string;
	id: string;
	body: Record<Exclude<keyof Flow, "last_seen" | "id">, string | number | undefined>;
}

