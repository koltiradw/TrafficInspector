#ifndef __DPI_WORKER_H__
#define __DPI_WORKER_H__

#include <pthread.h>

#include "lfqueue.h"

#include "config.h"
#include "ndpi_workflow.h"

typedef struct {
    int id;
    int number_of_workers;
    pthread_t thread;
    ndpi_workflow_t* workflow;
    lfqueue_t* message_queue;
} dpi_worker_t;

dpi_worker_t* init_dpi_workers(const config_t* config, int fanout_group_id, lfqueue_t* mq);
void deinit_dpi_workers(dpi_worker_t* worker);
void* run_dpi_worker(void* args);

#endif /* __DPI_WORKER__ */