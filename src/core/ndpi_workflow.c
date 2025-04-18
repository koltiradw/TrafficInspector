#include "ndpi_workflow.h"
#include "dpi_worker.h"
#include "utils.h"

#include <uuid/uuid.h>
#include <zmq.h>

#include <errno.h>
#include <linux/if_ether.h>
#include <time.h>
#include <unistd.h>

// consts from nDPISimpleIntegration....
#define MAX_FLOW_ROOTS_PER_THREAD 2048
#define MAX_IDLE_FLOWS_PER_THREAD 64
#define TICK_RESOLUTION           1000
#define IDLE_SCAN_PERIOD          10000  /* msec */
#define MAX_IDLE_TIME             300000 /* msec */
#define INITIAL_THREAD_HASH       0x03dd018b
#define MAX_NUM_OF_UDP_PKTS       8
#define MAX_NUM_OF_TCP_PKTS       24

enum IP_TYPE { IPv4 = 4, IPv6 = 6 };

typedef struct {
    uint64_t src_num_of_pkts;
    uint64_t dst_num_of_pkts;
    uint64_t src_len_of_pkts;
    uint64_t dst_len_of_pkts;
    uint64_t first_seen;
    uint64_t last_seen;
    uint64_t hashval;

    char* src_os;
    char* dst_os;
    char uuid[37];
    enum IP_TYPE l3_type;

    uint8_t src_mac[6];
    uint8_t dst_mac[6];

    union {
        struct {
            uint32_t src;
            uint32_t pad_00[3];
            uint32_t dst;
            uint32_t pad_01[3];
        } v4;

        struct {
            uint64_t src[2];
            uint64_t dst[2];
        } v6;

        struct {
            uint32_t src[4];
            uint32_t dst[4];
        } u32;
    } ip_tuple;

    uint16_t src_port;
    uint16_t dst_port;

    bool is_src_to_dst;
    uint8_t is_midstream_flow : 1;
    uint8_t flow_fin_ack_seen : 1;
    uint8_t flow_ack_seen     : 1;
    bool detection_completed;
    bool ready_to_dump;
    bool dpi_info_dumped;
    uint8_t l4_protocol;

    struct ndpi_proto detected_l7_protocol;
    struct ndpi_flow_struct* ndpi_flow;
    ndpi_serializer flow_serializer;
} ndpi_flow_info_t;

ndpi_workflow_t*
init_workflow(const char* name_of_device, int fanout_group_id, const char* path_to_country_db,
              const char* path_to_asn_db, const char* zmq_endpoint) {
    ndpi_workflow_t* workflow = NULL;
    if (!(workflow = (ndpi_workflow_t*)ndpi_calloc(1, sizeof(ndpi_workflow_t)))) {
        return NULL;
    }

    if (!(workflow->handle = open_afpacket_socket(name_of_device, fanout_group_id))) {
        free_workflow(workflow);
        return NULL;
    }

    if (!(workflow->socket = init_zmq_log(zmq_endpoint))) {
        free_workflow(workflow);
        return NULL;
    }

    if (!(workflow->ndpi_struct = ndpi_init_detection_module(NULL))) {
        free_workflow(workflow);
        return NULL;
    }

    workflow->total_active_flows = 0;
    workflow->max_active_flows = MAX_FLOW_ROOTS_PER_THREAD;
    if (!(workflow->ndpi_flows_active = (void**)ndpi_calloc(workflow->max_active_flows, sizeof(void*)))) {
        free_workflow(workflow);
        return NULL;
    }

    workflow->total_idle_flows = 0;
    workflow->max_idle_flows = MAX_IDLE_FLOWS_PER_THREAD;
    if (!(workflow->ndpi_flows_idle = (void**)ndpi_calloc(workflow->max_idle_flows, sizeof(void*)))) {
        free_workflow(workflow);
        return NULL;
    }

    NDPI_PROTOCOL_BITMASK protos;
    NDPI_BITMASK_SET_ALL(protos);
    if (ndpi_set_protocol_detection_bitmask2(workflow->ndpi_struct, &protos) == -1) {
        free_workflow(workflow);
        return NULL;
    }
    if (ndpi_finalize_initialization(workflow->ndpi_struct) == -1) {
        free_workflow(workflow);
        return NULL;
    }

    ndpi_set_config(workflow->ndpi_struct, "dns", "subclassification", "1");
    ndpi_set_config(workflow->ndpi_struct, "tls", "application_blocks_tracking", "1");

    if (ndpi_load_geoip(workflow->ndpi_struct, path_to_country_db, path_to_asn_db) < 0) {
        free_workflow(workflow);
        return NULL;
    }

    return workflow;
}

static void
__ndpi_flow_info_free(void* const node) {
    ndpi_flow_info_t* const flow = (ndpi_flow_info_t*)node;

    ndpi_flow_free(flow->ndpi_flow);
    ndpi_term_serializer(&flow->flow_serializer);
    ndpi_free(flow->src_os);
    ndpi_free(flow->dst_os);
    ndpi_free(flow);
}

void
free_workflow(ndpi_workflow_t* workflow) {
    if (workflow->ndpi_struct != NULL) {
        ndpi_exit_detection_module(workflow->ndpi_struct);
    }
    for (size_t i = 0; i < workflow->max_active_flows; i++) {
        ndpi_tdestroy(workflow->ndpi_flows_active[i], __ndpi_flow_info_free);
    }

    afpacket_close(workflow->handle);
    deinit_zmq_log(workflow->socket);
    ndpi_free(workflow->ndpi_flows_active);
    ndpi_free(workflow->ndpi_flows_idle);
    ndpi_free(workflow);
}

static int
__ip_tuples_compare(ndpi_flow_info_t const* const A, ndpi_flow_info_t const* const B) {
    if (A->l3_type == IPv4 && B->l3_type == IPv4) {
        if (A->ip_tuple.v4.src < B->ip_tuple.v4.src) {
            return -1;
        }
        if (A->ip_tuple.v4.src > B->ip_tuple.v4.src) {
            return 1;
        }
        if (A->ip_tuple.v4.dst < B->ip_tuple.v4.dst) {
            return -1;
        }
        if (A->ip_tuple.v4.dst > B->ip_tuple.v4.dst) {
            return 1;
        }
    } else if (A->l3_type == IPv6 && B->l3_type == IPv6) {
        if (A->ip_tuple.v6.src[0] < B->ip_tuple.v6.src[0] && A->ip_tuple.v6.src[1] < B->ip_tuple.v6.src[1]) {
            return -1;
        }
        if (A->ip_tuple.v6.src[0] > B->ip_tuple.v6.src[0] && A->ip_tuple.v6.src[1] > B->ip_tuple.v6.src[1]) {
            return 1;
        }
        if (A->ip_tuple.v6.dst[0] < B->ip_tuple.v6.dst[0] && A->ip_tuple.v6.dst[1] < B->ip_tuple.v6.dst[1]) {
            return -1;
        }
        if (A->ip_tuple.v6.dst[0] > B->ip_tuple.v6.dst[0] && A->ip_tuple.v6.dst[1] > B->ip_tuple.v6.dst[1]) {
            return 1;
        }
    }

    if (A->src_port < B->src_port) {
        return -1;
    }
    if (A->src_port > B->src_port) {
        return 1;
    }
    if (A->dst_port < B->dst_port) {
        return -1;
    }
    if (A->dst_port > B->dst_port) {
        return 1;
    }

    return 0;
}

static void
__ndpi_idle_scan_walker(void const* const A, ndpi_VISIT which, int deep, void* const user_data) {
    ndpi_workflow_t* const workflow = (ndpi_workflow_t*)user_data;
    ndpi_flow_info_t* const flow = *(ndpi_flow_info_t**)A;

    (void)deep;

    if (workflow == NULL || flow == NULL) {
        return;
    }

    if (workflow->cur_idle_flows == MAX_IDLE_FLOWS_PER_THREAD) {
        return;
    }

    if (which == ndpi_preorder || which == ndpi_leaf) {
        if ((flow->flow_fin_ack_seen == 1 && flow->flow_ack_seen == 1)
            || flow->last_seen + MAX_IDLE_TIME < get_current_time_ms()) {
            workflow->ndpi_flows_idle[workflow->cur_idle_flows++] = flow;
            workflow->total_idle_flows++;
        }
    }
}

static int
__ndpi_workflow_node_cmp(void const* const A, void const* const B) {
    ndpi_flow_info_t const* const flow_info_a = (ndpi_flow_info_t*)A;
    ndpi_flow_info_t const* const flow_info_b = (ndpi_flow_info_t*)B;

    if (flow_info_a->hashval < flow_info_b->hashval) {
        return (-1);
    } else if (flow_info_a->hashval > flow_info_b->hashval) {
        return (1);
    }

    /* Flows have the same hash */
    if (flow_info_a->l4_protocol < flow_info_b->l4_protocol) {
        return (-1);
    } else if (flow_info_a->l4_protocol > flow_info_b->l4_protocol) {
        return (1);
    }

    return __ip_tuples_compare(flow_info_a, flow_info_b);
}

static void
__check_for_idle_flows(ndpi_workflow_t* const workflow) {
    if (workflow->last_idle_scan_time + IDLE_SCAN_PERIOD < workflow->last_time) {
        for (size_t idle_scan_index = 0; idle_scan_index < workflow->max_active_flows; ++idle_scan_index) {
            ndpi_twalk(workflow->ndpi_flows_active[idle_scan_index], __ndpi_idle_scan_walker, workflow);

            while (workflow->cur_idle_flows > 0) {
                ndpi_flow_info_t* const f = (ndpi_flow_info_t*)workflow->ndpi_flows_idle[--workflow->cur_idle_flows];
                ndpi_tdelete(f, &workflow->ndpi_flows_active[idle_scan_index], __ndpi_workflow_node_cmp);
                __ndpi_flow_info_free(f);
                workflow->cur_active_flows--;
            }
        }

        workflow->last_idle_scan_time = workflow->last_time;
    }
}

void
serialize_dpi_info(ndpi_workflow_t* workflow, ndpi_flow_info_t* flow) {
    char src_country[32] = {'\0'}, dst_country[32] = {'\0'}, src_as[32] = {'\0'}, dst_as[32] = {'\0'}, mac[19] = {'\0'};
    char src_name[INET6_ADDRSTRLEN] = {'\0'}, dst_name[INET6_ADDRSTRLEN] = {'\0'};
    uint32_t as = 0;
    const char* local = "local";
    const char* unknown = "unknown";

    ndpi_flow2json(workflow->ndpi_struct, flow->ndpi_flow, flow->l3_type, flow->l4_protocol, 0, flow->ip_tuple.v4.src,
                   flow->ip_tuple.v4.dst, (struct ndpi_in6_addr*)flow->ip_tuple.v6.src,
                   (struct ndpi_in6_addr*)flow->ip_tuple.v6.dst, htons(flow->src_port), htons(flow->dst_port),
                   flow->detected_l7_protocol, &flow->flow_serializer);

    if (flow->l3_type == IPv4) {
        if (is_private_ipv4(ntohl(flow->ip_tuple.v4.src))) {
            strncpy(src_country, local, strlen(local));
            strncpy(src_as, local, strlen(local));
        } else {
            inet_ntop(AF_INET, &flow->ip_tuple.v4.src, src_name, sizeof(src_name));
            ndpi_get_geoip_country_continent(workflow->ndpi_struct, src_name, src_country, sizeof(src_name), NULL, 0);
            if (src_country[0] == '\0') {
                strncpy(src_country, unknown, strlen(unknown));
            }
            ndpi_get_geoip_asn(workflow->ndpi_struct, src_name, &as);
            if (as == 0) {
                strncpy(src_as, unknown, strlen(unknown));
            } else {
                ndpi_snprintf(src_as, sizeof(src_as), "AS%u", as);
            }
        }

        if (is_private_ipv4(ntohl(flow->ip_tuple.v4.dst))) {
            strncpy(dst_country, local, strlen(local));
            strncpy(dst_as, local, strlen(local));
        } else {
            inet_ntop(AF_INET, &flow->ip_tuple.v4.dst, dst_name, sizeof(dst_name));
            ndpi_get_geoip_country_continent(workflow->ndpi_struct, dst_name, dst_country, sizeof(dst_name), NULL, 0);
            if (dst_country[0] == '\0') {
                strncpy(dst_country, unknown, strlen(unknown));
            }
            ndpi_get_geoip_asn(workflow->ndpi_struct, dst_name, &as);
            if (as == 0) {
                strncpy(dst_as, unknown, strlen(unknown));
            } else {
                ndpi_snprintf(dst_as, sizeof(dst_as), "AS%u", as);
            }
        }
    } else {
        if (is_private_ipv6(bswap_64(flow->ip_tuple.v6.src[0]))) {
            strncpy(src_country, local, strlen(local));
            strncpy(src_as, local, strlen(local));
        } else {
            inet_ntop(AF_INET, &flow->ip_tuple.v6.src, src_name, sizeof(src_name));
            ndpi_get_geoip_country_continent(workflow->ndpi_struct, src_name, src_country, sizeof(src_name), NULL, 0);
            if (src_country[0] == '\0') {
                strncpy(src_country, unknown, strlen(unknown));
            }
            ndpi_get_geoip_asn(workflow->ndpi_struct, src_name, &as);
            if (as == 0) {
                strncpy(src_as, unknown, strlen(unknown));
            } else {
                ndpi_snprintf(src_as, sizeof(src_as), "AS%u", as);
            }
        }

        if (is_private_ipv6(bswap_64(flow->ip_tuple.v6.dst[0]))) {
            strncpy(dst_country, local, strlen(local));
            strncpy(dst_as, local, strlen(local));
        } else {
            inet_ntop(AF_INET, &flow->ip_tuple.v6.dst, dst_name, sizeof(dst_name));
            ndpi_get_geoip_country_continent(workflow->ndpi_struct, dst_name, dst_country, sizeof(dst_name), NULL, 0);
            if (dst_country[0] == '\0') {
                strncpy(dst_country, unknown, strlen(unknown));
            }
            ndpi_get_geoip_asn(workflow->ndpi_struct, dst_name, &as);
            if (as == 0) {
                strncpy(dst_as, unknown, strlen(unknown));
            } else {
                ndpi_snprintf(dst_as, sizeof(dst_as), "AS%u", as);
            }
        }
    }

    if (flow->ndpi_flow->tcp.fingerprint) {
        ndpi_serialize_string_string(&flow->flow_serializer, "src_os",
                                     ndpi_print_os_hint(flow->ndpi_flow->tcp.os_hint));
    }

    mac_to_string(flow->src_mac, mac);
    ndpi_serialize_string_string(&flow->flow_serializer, "src_mac", mac);
    mac_to_string(flow->dst_mac, mac);
    ndpi_serialize_string_string(&flow->flow_serializer, "dst_mac", mac);
    ndpi_serialize_string_string(&flow->flow_serializer, "uuid", flow->uuid);
    ndpi_serialize_string_string(&flow->flow_serializer, "src_country", src_country);
    ndpi_serialize_string_string(&flow->flow_serializer, "dst_country", dst_country);
    ndpi_serialize_string_string(&flow->flow_serializer, "src_as", src_as);
    ndpi_serialize_string_string(&flow->flow_serializer, "dst_as", dst_as);
}

void
serialize_stats_info(ndpi_flow_info_t* flow) {
    char first_seen[50] = {'\0'}, last_seen[50] = {'\0'};
    convert_timestamp_to_datetime(flow->first_seen / 1000, first_seen, sizeof(first_seen));
    convert_timestamp_to_datetime(flow->last_seen / 1000, last_seen, sizeof(first_seen));
    ndpi_serialize_string_string(&flow->flow_serializer, "uuid", flow->uuid);
    ndpi_serialize_string_string(&flow->flow_serializer, "first_seen", first_seen);
    ndpi_serialize_string_string(&flow->flow_serializer, "last_seen", last_seen);
    ndpi_serialize_string_uint64(&flow->flow_serializer, "src_num_pkts", flow->src_num_of_pkts);
    ndpi_serialize_string_uint64(&flow->flow_serializer, "dst_num_pkts", flow->dst_num_of_pkts);
    ndpi_serialize_string_uint64(&flow->flow_serializer, "src_len_pkts", flow->src_len_of_pkts);
    ndpi_serialize_string_uint64(&flow->flow_serializer, "dst_len_pkts", flow->dst_len_of_pkts);
}

void
ndpi_process_packet(const uint8_t* args, const struct afpacket_pkthdr* header, const uint8_t* packet) {
    dpi_worker_t* worker = (dpi_worker_t*)args;

    if (!worker) {
        return;
    }

    ndpi_workflow_t* workflow = worker->workflow;

    if (!workflow) {
        return;
    }

    ndpi_flow_info_t flow;

    size_t hashed_index;
    void* tree_result;
    ndpi_flow_info_t* flow_to_process;

    const struct ndpi_ethhdr* ethernet;
    const struct ndpi_iphdr* ip;
    struct ndpi_ipv6hdr* ip6;

    uint64_t time_ms;
    const uint16_t eth_offset = 0;
    uint16_t ip_offset;
    uint16_t ip_size;

    const uint8_t* l4_ptr = NULL;
    uint16_t l4_len = 0;

    uint16_t type;
    uint32_t thread_index = INITIAL_THREAD_HASH;

    memset(&flow, 0, sizeof(flow));

    time_ms = (((uint64_t)header->ts.tv_sec) * TICK_RESOLUTION + header->ts.tv_usec / (1000000 / TICK_RESOLUTION));

    workflow->last_time = time_ms;

    __check_for_idle_flows(workflow);

    if (header->len < sizeof(struct ndpi_ethhdr)) {
        return;
    }
    ethernet = (struct ndpi_ethhdr*)&packet[eth_offset];
    ip_offset = sizeof(struct ndpi_ethhdr) + eth_offset;
    type = ntohs(ethernet->h_proto);
    memcpy(flow.src_mac, ethernet->h_source, sizeof(flow.src_mac));
    memcpy(flow.dst_mac, ethernet->h_dest, sizeof(flow.dst_mac));
    switch (type) {
        case ETH_P_IP: /* IPv4 */
            if (header->len < sizeof(struct ndpi_ethhdr) + sizeof(struct ndpi_iphdr)) {
                return;
            }
            ip = (struct ndpi_iphdr*)&packet[ip_offset];
            ip6 = NULL;
            break;
        case ETH_P_IPV6: /* IPV6 */
            if (header->len < sizeof(struct ndpi_ethhdr) + sizeof(struct ndpi_ipv6hdr)) {
                return;
            }
            ip = NULL;
            ip6 = (struct ndpi_ipv6hdr*)&packet[ip_offset];
            break;
        default: return;
    }

    ip_size = header->len - ip_offset;

    if (type == ETH_P_IP && header->len >= ip_offset) {
        if (header->caplen < header->len) {
            return;
        }
    }

    /* process layer3 e.g. IPv4 / IPv6 */
    if (ip != NULL && ip->version == 4) {
        if (ip_size < sizeof(*ip)) {
            return;
        }

        flow.l3_type = IPv4;
        if (ndpi_detection_get_l4((uint8_t*)ip, ip_size, &l4_ptr, &l4_len, &flow.l4_protocol, NDPI_DETECTION_ONLY_IPV4)
            != 0) {
            return;
        }

        flow.ip_tuple.v4.src = ip->saddr;
        flow.ip_tuple.v4.dst = ip->daddr;
        uint32_t min_addr = (flow.ip_tuple.v4.src > flow.ip_tuple.v4.dst ? flow.ip_tuple.v4.dst : flow.ip_tuple.v4.src);
        thread_index = min_addr + ip->protocol;
    } else if (ip6 != NULL) {
        if (ip_size < sizeof(ip6->ip6_hdr)) {
            return;
        }

        flow.l3_type = IPv6;
        if (ndpi_detection_get_l4((uint8_t*)ip6, ip_size, &l4_ptr, &l4_len, &flow.l4_protocol, NDPI_DETECTION_ONLY_IPV6)
            != 0) {
            return;
        }

        flow.ip_tuple.v6.src[0] = ip6->ip6_src.u6_addr.u6_addr64[0];
        flow.ip_tuple.v6.src[1] = ip6->ip6_src.u6_addr.u6_addr64[1];
        flow.ip_tuple.v6.dst[0] = ip6->ip6_dst.u6_addr.u6_addr64[0];
        flow.ip_tuple.v6.dst[1] = ip6->ip6_dst.u6_addr.u6_addr64[1];
        uint64_t min_addr[2];
        if (flow.ip_tuple.v6.src[0] > flow.ip_tuple.v6.dst[0] && flow.ip_tuple.v6.src[1] > flow.ip_tuple.v6.dst[1]) {
            min_addr[0] = flow.ip_tuple.v6.dst[0];
            min_addr[1] = flow.ip_tuple.v6.dst[0];
        } else {
            min_addr[0] = flow.ip_tuple.v6.src[0];
            min_addr[1] = flow.ip_tuple.v6.src[0];
        }
        thread_index = min_addr[0] + min_addr[1] + ip6->ip6_hdr.ip6_un1_nxt;
    } else {
        return;
    }

    /* process layer4 e.g. TCP / UDP */
    if (flow.l4_protocol == IPPROTO_TCP) {
        const struct ndpi_tcphdr* tcp;

        if (header->len < (l4_ptr - packet) + sizeof(struct ndpi_tcphdr)) {
            return;
        }
        tcp = (struct ndpi_tcphdr*)l4_ptr;
        flow.is_midstream_flow = (tcp->syn == 0 ? 1 : 0);
        flow.flow_fin_ack_seen = (tcp->fin == 1 && tcp->ack == 1 ? 1 : 0);
        flow.flow_ack_seen = tcp->ack;
        flow.src_port = ntohs(tcp->source);
        flow.dst_port = ntohs(tcp->dest);
    } else if (flow.l4_protocol == IPPROTO_UDP) {
        const struct ndpi_udphdr* udp;

        if (header->len < (l4_ptr - packet) + sizeof(struct ndpi_udphdr)) {
            return;
        }
        udp = (struct ndpi_udphdr*)l4_ptr;
        flow.src_port = ntohs(udp->source);
        flow.dst_port = ntohs(udp->dest);
    }

    thread_index += (flow.src_port < flow.dst_port ? flow.dst_port : flow.src_port);
    thread_index %= worker->number_of_workers;
    if (thread_index != worker->id) {
        return;
    }

    {
        uint64_t tmp[4] = {};

        /* calculate flow hash for btree find, search(insert) */
        if (flow.l3_type == IPv4) {
            if (ndpi_flowv4_flow_hash(flow.l4_protocol, flow.ip_tuple.v4.src, flow.ip_tuple.v4.dst, flow.src_port,
                                      flow.dst_port, 0, 0, (uint8_t*)&tmp[0], sizeof(tmp))
                != 0) {
                flow.hashval = flow.ip_tuple.v4.src + flow.ip_tuple.v4.dst; // fallback
            } else {
                flow.hashval = tmp[0] + tmp[1] + tmp[2] + tmp[3];
            }
        } else if (flow.l3_type == IPv6) {
            if (ndpi_flowv6_flow_hash(flow.l4_protocol, &ip6->ip6_src, &ip6->ip6_dst, flow.src_port, flow.dst_port, 0,
                                      0, (uint8_t*)&tmp[0], sizeof(tmp))
                != 0) {
                flow.hashval = flow.ip_tuple.v6.src[0] + flow.ip_tuple.v6.src[1];
                flow.hashval += flow.ip_tuple.v6.dst[0] + flow.ip_tuple.v6.dst[1];
            } else {
                flow.hashval = tmp[0] + tmp[1] + tmp[2] + tmp[3];
            }
        }

        flow.hashval += flow.l4_protocol + flow.src_port + flow.dst_port;
    }

    bool is_src_to_dst = true;

    hashed_index = flow.hashval % workflow->max_active_flows;
    tree_result = ndpi_tfind(&flow, &workflow->ndpi_flows_active[hashed_index], __ndpi_workflow_node_cmp);
    if (tree_result == NULL) {
        is_src_to_dst = false;
        /* flow not found in btree: switch src <-> dst and try to find it again */
        const uint32_t orig_src_ip[4] = {flow.ip_tuple.u32.src[0], flow.ip_tuple.u32.src[1], flow.ip_tuple.u32.src[2],
                                         flow.ip_tuple.u32.src[3]};
        const uint32_t orig_dst_ip[4] = {flow.ip_tuple.u32.dst[0], flow.ip_tuple.u32.dst[1], flow.ip_tuple.u32.dst[2],
                                         flow.ip_tuple.u32.dst[3]};
        uint16_t orig_src_port = flow.src_port;
        uint16_t orig_dst_port = flow.dst_port;

        flow.ip_tuple.u32.src[0] = orig_dst_ip[0];
        flow.ip_tuple.u32.src[1] = orig_dst_ip[1];
        flow.ip_tuple.u32.src[2] = orig_dst_ip[2];
        flow.ip_tuple.u32.src[3] = orig_dst_ip[3];

        flow.ip_tuple.u32.dst[0] = orig_src_ip[0];
        flow.ip_tuple.u32.dst[1] = orig_src_ip[1];
        flow.ip_tuple.u32.dst[2] = orig_src_ip[2];
        flow.ip_tuple.u32.dst[3] = orig_src_ip[3];

        flow.src_port = orig_dst_port;
        flow.dst_port = orig_src_port;

        tree_result = ndpi_tfind(&flow, &workflow->ndpi_flows_active[hashed_index], __ndpi_workflow_node_cmp);

        flow.ip_tuple.u32.src[0] = orig_src_ip[0];
        flow.ip_tuple.u32.src[1] = orig_src_ip[1];
        flow.ip_tuple.u32.src[2] = orig_src_ip[2];
        flow.ip_tuple.u32.src[3] = orig_src_ip[3];

        flow.ip_tuple.u32.dst[0] = orig_dst_ip[0];
        flow.ip_tuple.u32.dst[1] = orig_dst_ip[1];
        flow.ip_tuple.u32.dst[2] = orig_dst_ip[2];
        flow.ip_tuple.u32.dst[3] = orig_dst_ip[3];

        flow.src_port = orig_src_port;
        flow.dst_port = orig_dst_port;
    }

    if (tree_result == NULL) {
        is_src_to_dst = true;
        /* flow still not found, must be new */
        if (workflow->cur_active_flows == workflow->max_active_flows) {
            return;
        }

        flow_to_process = (ndpi_flow_info_t*)ndpi_malloc(sizeof(*flow_to_process));
        if (flow_to_process == NULL) {
            return;
        }

        memcpy(flow_to_process, &flow, sizeof(*flow_to_process));

        flow_to_process->ndpi_flow = (struct ndpi_flow_struct*)ndpi_flow_malloc(SIZEOF_FLOW_STRUCT);
        if (flow_to_process->ndpi_flow == NULL) {
            return;
        }
        memset(flow_to_process->ndpi_flow, 0, SIZEOF_FLOW_STRUCT);
        ndpi_init_serializer(&flow_to_process->flow_serializer, ndpi_serialization_format_json);
        flow_to_process->detection_completed = false;
        flow_to_process->ready_to_dump = false;
        flow_to_process->src_os = NULL;
        flow_to_process->dst_os = NULL;
        uuid_t uuid;
        uuid_generate_random(uuid);
        uuid_unparse(uuid, flow_to_process->uuid);
        if (ndpi_tsearch(flow_to_process, &workflow->ndpi_flows_active[hashed_index], __ndpi_workflow_node_cmp)
            == NULL) {
            /* Possible Leak, but should not happen as we'd abort earlier. */
            return;
        }

        workflow->cur_active_flows++;
        workflow->total_active_flows++;
    } else {
        flow_to_process = *(ndpi_flow_info_t**)tree_result;
    }

    if (is_src_to_dst) {
        flow_to_process->src_num_of_pkts++;
        flow_to_process->src_len_of_pkts += header->len;
    } else {
        flow_to_process->dst_num_of_pkts++;
        flow_to_process->dst_len_of_pkts += header->len;
    }

    /* update timestamps, important for timeout handling */
    if (flow_to_process->first_seen == 0) {
        flow_to_process->first_seen = time_ms;
    }
    flow_to_process->last_seen = time_ms;
    /* current packet is an TCP-ACK? */
    flow_to_process->flow_ack_seen = flow.flow_ack_seen;

    /* TCP-FIN: indicates that at least one side wants to end the connection */
    if (flow.flow_fin_ack_seen != 0 && flow_to_process->flow_fin_ack_seen == 0) {
        flow_to_process->flow_fin_ack_seen = 1;
        return;
    }
    if (!flow_to_process->detection_completed) {
        flow_to_process->detected_l7_protocol = ndpi_detection_process_packet(
            workflow->ndpi_struct, flow_to_process->ndpi_flow, ip != NULL ? (uint8_t*)ip : (uint8_t*)ip6, ip_size,
            time_ms, NULL);

        if (ndpi_is_protocol_detected(flow_to_process->detected_l7_protocol) != 0) {
            if (!ndpi_is_proto_unknown(flow_to_process->detected_l7_protocol.proto)) {
                if (!ndpi_extra_dissection_possible(workflow->ndpi_struct, flow_to_process->ndpi_flow)) {
                    flow_to_process->detection_completed = true;
                    flow_to_process->ready_to_dump = true;
                }
            }
        } else {
            uint16_t max_num_pkts = (flow_to_process->l4_protocol == IPPROTO_UDP) ? MAX_NUM_OF_UDP_PKTS
                                                                                  : MAX_NUM_OF_TCP_PKTS;

            if (flow_to_process->src_num_of_pkts + flow_to_process->dst_num_of_pkts > max_num_pkts) {
                uint8_t proto_guessed = 0;

                flow_to_process->detected_l7_protocol = ndpi_detection_giveup(
                    workflow->ndpi_struct, flow_to_process->ndpi_flow, &proto_guessed);
                flow_to_process->detection_completed = true;
                if (ndpi_is_proto_unknown(flow_to_process->detected_l7_protocol.proto)) {
                    flow_to_process->detection_completed = false;
                }
                flow_to_process->ready_to_dump = true;
            }
        }
    }
    if (flow_to_process->ready_to_dump) {
        uint32_t json_str_len = 0;
        if (!flow_to_process->dpi_info_dumped) {
            serialize_dpi_info(workflow, flow_to_process);
            serialize_stats_info(flow_to_process);
            const char* json_str = ndpi_serializer_get_buffer(&flow_to_process->flow_serializer, &json_str_len);

            while (zmq_send(workflow->socket->pusher, json_str, strlen(json_str), ZMQ_DONTWAIT) == -1) {
                if (errno == EAGAIN) {
                    usleep(1000);
                    continue;
                }
                perror("zmq_send");
                break;
            }

            flow_to_process->dpi_info_dumped = true;
        }
        serialize_stats_info(flow_to_process);
        const char* json_str = ndpi_serializer_get_buffer(&flow_to_process->flow_serializer, &json_str_len);

        while (zmq_send(workflow->socket->pusher, json_str, strlen(json_str), ZMQ_DONTWAIT) == -1) {
            if (errno == EAGAIN) {
                usleep(1000);
                continue;
            }
            perror("zmq_send");
            break;
        }

        

        ndpi_reset_serializer(&flow_to_process->flow_serializer);
    }
}