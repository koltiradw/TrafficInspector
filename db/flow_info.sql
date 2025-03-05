CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE FLOW_INFO (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        src_mac TEXT,
        dst_mac TEXT,
        src_ip TEXT,
        dst_ip TEXT,
        src_port INT,
        dst_port INT,
        ipv INT,
        tcp_fingerprint TEXT,
        src_os TEXT,
        dst_os TEXT,
        proto TEXT,
        src_country TEXT,
        dst_country TEXT,
        src_as TEXT,
        dst_as TEXT,
        first_seen timestamp,
        last_seen timestamp,
        src_num_pkts bigint,
	dst_num_pkts bigint,
	src_len_pkts bigint,
	dst_len_pkts bigint,
        ndpi JSONB
);