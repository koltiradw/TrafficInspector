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
    uint64_t client_num_of_pkts;
    uint64_t server_num_of_pkts;
    uint64_t client_len_of_pkts;
    uint64_t server_len_of_pkts;
    uint64_t first_seen;
    uint64_t last_seen;
    uint64_t hashval;

    char* client_os;
    char* server_os;
    uuid_t uuid;
    enum IP_TYPE l3_type;

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
    uint8_t l4_protocol;

    struct ndpi_proto detected_l7_protocol;
    struct ndpi_flow_struct* ndpi_flow;
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

    if (ndpi_init_serializer(&workflow->flow_serializer, ndpi_serialization_format_json) == -1) {
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
    ndpi_free(flow->client_os);
    ndpi_free(flow->server_os);
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
    ndpi_term_serializer(&workflow->flow_serializer);
    ndpi_free(workflow->ndpi_flows_active);
    ndpi_free(workflow->ndpi_flows_idle);
    ndpi_free(workflow);
}

static int
__ip_tuple_to_string(ndpi_flow_info_t const* const flow, char* const src_addr_str, size_t src_addr_len,
                     char* const dst_addr_str, size_t dst_addr_len) {
    switch (flow->l3_type) {
        case IPv4:
            return inet_ntop(AF_INET, (struct sockaddr_in*)&flow->ip_tuple.v4.src, src_addr_str, src_addr_len) != NULL
                   && inet_ntop(AF_INET, (struct sockaddr_in*)&flow->ip_tuple.v4.dst, dst_addr_str, dst_addr_len)
                          != NULL;
        case IPv6:
            return inet_ntop(AF_INET6, (struct sockaddr_in6*)&flow->ip_tuple.v6.src[0], src_addr_str, src_addr_len)
                       != NULL
                   && inet_ntop(AF_INET6, (struct sockaddr_in6*)&flow->ip_tuple.v6.dst[0], dst_addr_str, dst_addr_len)
                          != NULL;
    }

    return 0;
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
            || flow->last_seen + MAX_IDLE_TIME < workflow->last_time) {
            char src_addr_str[INET6_ADDRSTRLEN + 1];
            char dst_addr_str[INET6_ADDRSTRLEN + 1];
            __ip_tuple_to_string(flow, src_addr_str, sizeof(src_addr_str), dst_addr_str, sizeof(dst_addr_str));
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

    time_ms = (((uint64_t)header->ts.tv_sec) * TICK_RESOLUTION + header->ts.tv_usec / (1000000 / TICK_RESOLUTION))
              / 1000;
    workflow->last_time = time_ms;

    __check_for_idle_flows(workflow);

    if (header->len < sizeof(struct ndpi_ethhdr)) {
        return;
    }
    ethernet = (struct ndpi_ethhdr*)&packet[eth_offset];
    ip_offset = sizeof(struct ndpi_ethhdr) + eth_offset;
    type = ntohs(ethernet->h_proto);
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
        flow_to_process->detection_completed = false;
        flow_to_process->ready_to_dump = false;
        flow_to_process->client_os = NULL;
        flow_to_process->server_os = NULL;
        uuid_generate_random(flow_to_process->uuid);
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
        flow_to_process->client_num_of_pkts++;
        flow_to_process->client_len_of_pkts += header->len;
    } else {
        flow_to_process->server_num_of_pkts++;
        flow_to_process->server_len_of_pkts += header->len;
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

            if (flow_to_process->client_num_of_pkts + flow_to_process->server_num_of_pkts > max_num_pkts) {
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
        if (flow_to_process->ndpi_flow->tcp.fingerprint) {
            if (is_src_to_dst) {

                if (!flow_to_process->client_os) {
                    flow_to_process->client_os = ndpi_strdup(
                        ndpi_print_os_hint(flow_to_process->ndpi_flow->tcp.os_hint));
                    flow_to_process->ndpi_flow->tcp.fingerprint = NULL;
                }
            } else {
                if (!flow_to_process->server_os) {
                    flow_to_process->server_os = ndpi_strdup(
                        ndpi_print_os_hint(flow_to_process->ndpi_flow->tcp.os_hint));
                    flow_to_process->ndpi_flow->tcp.fingerprint = NULL;
                }
            }
        }
    }
    if (flow_to_process->ready_to_dump) {
        uint32_t json_str_len = 0;
        ndpi_flow2json(workflow->ndpi_struct, flow_to_process->ndpi_flow, flow_to_process->l3_type,
                       flow_to_process->l4_protocol, 0, flow_to_process->ip_tuple.v4.src,
                       flow_to_process->ip_tuple.v4.dst, (struct ndpi_in6_addr*)flow_to_process->ip_tuple.v6.src,
                       (struct ndpi_in6_addr*)flow_to_process->ip_tuple.v6.dst, htons(flow_to_process->src_port),
                       htons(flow_to_process->dst_port), flow_to_process->detected_l7_protocol,
                       &workflow->flow_serializer);

        char src_country[32] = {'\0'}, dst_country[32] = {'\0'}, src_as[32] = {'\0'}, dst_as[32] = {'\0'},
             first_seen[50] = {'\0'}, last_seen[50] = {'\0'};
        char src_name[INET6_ADDRSTRLEN] = {'\0'}, dst_name[INET6_ADDRSTRLEN] = {'\0'};
        uint32_t as = 0;
        const char* local = "local";
        const char* unknown = "unknown";

        convert_timestamp_to_datetime(flow_to_process->first_seen, first_seen, sizeof(first_seen));
        convert_timestamp_to_datetime(flow_to_process->last_seen, last_seen, sizeof(first_seen));

        if (flow_to_process->l3_type == IPv4) {
            if (is_private_ipv4(ntohl(flow_to_process->ip_tuple.v4.src))) {
                memcpy(src_country, local, strlen(local));
                memcpy(src_as, local, strlen(local));
            } else {
                inet_ntop(AF_INET, &flow_to_process->ip_tuple.v4.src, src_name, sizeof(src_name));
                ndpi_get_geoip_country_continent(workflow->ndpi_struct, src_name, src_country, sizeof(src_name), NULL,
                                                 0);
                if (src_country[0] == '\0') {
                    memcpy(src_country, unknown, strlen(unknown));
                }
                ndpi_get_geoip_asn(workflow->ndpi_struct, src_name, &as);
                if (as == 0) {
                    memcpy(src_as, unknown, strlen(unknown));
                } else {
                    ndpi_snprintf(src_as, sizeof(src_as), "AS%lu", as);
                }
            }

            if (is_private_ipv4(ntohl(flow_to_process->ip_tuple.v4.dst))) {
                memcpy(dst_country, local, strlen(local));
                memcpy(dst_as, local, strlen(local));
            } else {
                inet_ntop(AF_INET, &flow_to_process->ip_tuple.v4.dst, dst_name, sizeof(dst_name));
                ndpi_get_geoip_country_continent(workflow->ndpi_struct, dst_name, dst_country, sizeof(dst_name), NULL,
                                                 0);
                if (dst_country[0] == '\0') {
                    memcpy(dst_country, unknown, strlen(unknown));
                }
                ndpi_get_geoip_asn(workflow->ndpi_struct, dst_name, &as);
                if (as == 0) {
                    memcpy(dst_as, unknown, strlen(unknown));
                } else {
                    ndpi_snprintf(dst_as, sizeof(dst_as), "AS%lu", as);
                }
            }
        } else {
            if (is_private_ipv6(bswap_64(flow_to_process->ip_tuple.v6.src[0]))) {
                memcpy(src_country, local, strlen(local));
            } else {
                inet_ntop(AF_INET, &flow_to_process->ip_tuple.v6.src, src_name, sizeof(src_name));
                ndpi_get_geoip_country_continent(workflow->ndpi_struct, src_name, src_country, sizeof(src_name), NULL,
                                                 0);
                if (src_country[0] == '\0') {
                    memcpy(src_country, unknown, strlen(unknown));
                }
                ndpi_get_geoip_asn(workflow->ndpi_struct, src_name, &as);
                if (as == 0) {
                    memcpy(src_as, unknown, strlen(unknown));
                } else {
                    ndpi_snprintf(src_as, sizeof(src_as), "AS%lu", as);
                }
            }

            if (is_private_ipv6(bswap_64(flow_to_process->ip_tuple.v6.dst[0]))) {
                memcpy(dst_country, local, strlen(local));
            } else {
                inet_ntop(AF_INET, &flow_to_process->ip_tuple.v6.dst, dst_name, sizeof(dst_name));
                ndpi_get_geoip_country_continent(workflow->ndpi_struct, dst_name, dst_country, sizeof(dst_name), NULL,
                                                 0);
                if (dst_country[0] == '\0') {
                    memcpy(dst_country, unknown, strlen(unknown));
                }
                ndpi_get_geoip_asn(workflow->ndpi_struct, dst_name, &as);
                if (as == 0) {
                    memcpy(dst_as, unknown, strlen(unknown));
                } else {
                    ndpi_snprintf(dst_as, sizeof(dst_as), "AS%lu", as);
                }
            }
        }
        if (flow_to_process->client_os) {
            ndpi_serialize_string_string(&workflow->flow_serializer, "client_os", flow_to_process->client_os);
        }

        if (flow_to_process->server_os) {
            ndpi_serialize_string_string(&workflow->flow_serializer, "server_os", flow_to_process->server_os);
        }

        char uuid_str[37];
        uuid_unparse(flow_to_process->uuid, uuid_str);

        ndpi_serialize_string_string(&workflow->flow_serializer, "uuid", uuid_str);
        ndpi_serialize_string_string(&workflow->flow_serializer, "src_country", src_country);
        ndpi_serialize_string_string(&workflow->flow_serializer, "dst_country", dst_country);
        ndpi_serialize_string_string(&workflow->flow_serializer, "src_as", src_as);
        ndpi_serialize_string_string(&workflow->flow_serializer, "dst_as", dst_as);
        ndpi_serialize_string_string(&workflow->flow_serializer, "first_seen", first_seen);
        ndpi_serialize_string_string(&workflow->flow_serializer, "last_seen", last_seen);
        ndpi_serialize_string_uint64(&workflow->flow_serializer, "client_num_pkts",
                                     flow_to_process->client_num_of_pkts);
        ndpi_serialize_string_uint64(&workflow->flow_serializer, "server_num_pkts",
                                     flow_to_process->server_num_of_pkts);
        ndpi_serialize_string_uint64(&workflow->flow_serializer, "client_len_pkts",
                                     flow_to_process->client_len_of_pkts);
        ndpi_serialize_string_uint64(&workflow->flow_serializer, "server_len_pkts",
                                     flow_to_process->server_len_of_pkts);
        const char* json_str = ndpi_serializer_get_buffer(&workflow->flow_serializer, &json_str_len);

        zmq_send(workflow->socket->pusher, json_str, strlen(json_str), ZMQ_DONTWAIT);

        ndpi_reset_serializer(&workflow->flow_serializer);
    }
}
