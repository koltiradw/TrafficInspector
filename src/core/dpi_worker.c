#include "dpi_worker.h"

static uint16_t DEFAULT_ZMQ_PORT = 5556;

dpi_worker_t*
init_dpi_workers(const config_t* config, int fanout_group_id) {
    dpi_worker_t* workers;
    if (!(workers = (dpi_worker_t*)calloc(config->number_of_workers, sizeof(dpi_worker_t)))) {
        return NULL;
    }

    char endpoint[32] = {'\0'};
    for (int i = 0; i < config->number_of_workers; i++) {
        snprintf(endpoint, sizeof(endpoint), "%s:%d", config->zmq_endpoint, DEFAULT_ZMQ_PORT);
        DEFAULT_ZMQ_PORT++;
        workers[i].id = i;
        workers[i].number_of_workers = config->number_of_workers;
        if (!(workers[i].workflow = init_workflow(config->name_of_device, fanout_group_id, config->path_to_country_db,
                                                  config->path_to_asn_db, endpoint))) {
            free(workers);
            return NULL;
        }
    }
    return workers;
}

void
deinit_dpi_workers(dpi_worker_t* workers) {
    for (int i = 0; i < workers->number_of_workers; i++) {
        free_workflow(workers[i].workflow);
    }
}

void*
run_dpi_worker(void* args) {
    dpi_worker_t* worker = (dpi_worker_t*)args;
    run_afpacket_loop(worker->workflow->handle, ndpi_process_packet, (uint8_t*)worker);
    return NULL;
}