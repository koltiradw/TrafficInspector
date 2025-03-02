CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE FLOW_INFO (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        src_ip TEXT,
        dst_ip TEXT,
        src_port INT,
        dst_port INT,
        ipv INT,
        tcp_fingerprint TEXT,
        client_os TEXT,
        server_os TEXT,
        proto TEXT,
        src_country TEXT,
        dst_country TEXT,
        src_as TEXT,
        dst_as TEXT,
        first_seen timestamp,
        last_seen timestamp,
        client_num_pkts bigint,
	server_num_pkts bigint,
	client_len_pkts bigint,
	server_len_pkts bigint,
        ndpi JSONB
);