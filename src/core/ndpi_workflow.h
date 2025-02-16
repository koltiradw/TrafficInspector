#ifndef __NDPI_WORKFLOW_H__
#define __NDPI_WORKFLOW_H__

#include <ndpi_api.h>
#include <ndpi_main.h>
#include <ndpi_typedefs.h>
#include <pthread.h>

#include "afpacket.h"
#include "collector_client.h"

typedef struct {
    afpacket_t* handle;
    collector_client_t* client;
    ndpi_serializer flow_serializer;
    uint64_t packets_captured;
    uint64_t detected_flow_protocols;

    uint64_t last_idle_scan_time;
    uint64_t last_time;

    void** ndpi_flows_active;
    uint64_t max_active_flows;
    uint64_t cur_active_flows;
    uint64_t total_active_flows;

    void** ndpi_flows_idle;
    uint64_t max_idle_flows;
    uint64_t cur_idle_flows;
    uint64_t total_idle_flows;

    struct ndpi_detection_module_struct* ndpi_struct;
} ndpi_workflow_t;

typedef struct {
    int id;
    int number_of_workers;
    pthread_t thread;
    ndpi_workflow_t* workflow;
} worker_t;

ndpi_workflow_t* init_workflow(const char* name_of_device, int fanout_group_id, const char* collector_host,
                               const int collector_port, const char* path_to_country_db, const char* path_to_asn_db);
void free_workflow(ndpi_workflow_t** const workflow);
void ndpi_process_packet(const uint8_t* args, const struct afpacket_pkthdr* header, const uint8_t* packet);

#endif /* __NDPI_WORKFLOW_H__ */
