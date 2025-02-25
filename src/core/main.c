#include <getopt.h>
#include <pthread.h>
#include <signal.h>
#include <stdatomic.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "ini.h"

#include "afpacket.h"
#include "config.h"
#include "dpi_worker.h"
#include "flowd_worker.h"
#include "lfqueue.h"
#include "ndpi_workflow.h"

const char* HELP = "TrafficInspector - simple packet inspection solution based on nDPI\n"
                   "\t-h           Help\n"
                   "\t-c path      Path to config file.\n";

static dpi_worker_t* dpi_workers = NULL;
static flowd_worker_t* flowd_worker = NULL;

static atomic_bool shutdown_requested = false;

static void
sig_handler(int sig) {
    (void)sig;
    atomic_store(&shutdown_requested, true);
}

static int
setup_workers(const config_t* config, lfqueue_t* mq) {
    struct sigaction action;
    action.sa_handler = sig_handler;
    sigemptyset(&action.sa_mask);
    action.sa_flags = 0;
    sigaction(SIGINT, &action, NULL);
    sigaction(SIGTERM, &action, NULL);

    int fanout_group_id = getpid() & 0xffff;

    if (!(flowd_worker = init_flowd_worker(config->flowd_endpoint, mq))) {
        fprintf(stderr, "Failed to init flowd worker\n");
        return -1;
    }

    if (!(dpi_workers = init_dpi_workers(config, fanout_group_id, mq))) {
        fprintf(stderr, "Failed to init dpi worker\n");
        return -1;
    }

    for (int i = 0; i < config->number_of_workers; i++) {
        printf("Starting thread [%d]\n", i);
        pthread_create(&dpi_workers[i].thread, NULL, run_dpi_worker, (void*)&dpi_workers[i]);
    }

    pthread_create(&flowd_worker->thread, NULL, run_flowd_worker, (void*)flowd_worker);
    return 0;
}

static void
stop_workers(const config_t* config) {
    for (int i = 0; i < config->number_of_workers; i++) {
        pthread_kill(dpi_workers[i].thread, SIGINT);
        pthread_join(dpi_workers[i].thread, NULL);
    }

    deinit_dpi_workers(dpi_workers);

    pthread_kill(flowd_worker->thread, SIGINT);
    pthread_join(flowd_worker->thread, NULL);
    deinit_flowd_worker(flowd_worker);
}

int
main(int argc, char** argv) {
    int option = -1;
    config_t config;
    char* path_to_config = NULL;
    lfqueue_t mq;

    if (lfqueue_init(&mq) == -1) {
        fprintf(stderr, "Failed to initialize queue\n");
        return -1;
    }

    while ((option = getopt(argc, argv, "hc:")) != -1) {
        switch (option) {
            case 'c': path_to_config = strdup(optarg); break;
            case 'h': printf("%s", HELP); return 0;
            case '?':
                if (optopt == 'c') {
                    fprintf(stderr, "Option -%c requires an argument.\n", optopt);
                } else {
                    fprintf(stderr, "Unknown option\n");
                }
                free(path_to_config);
                return 1;
        }
    }

    if (ini_parse(path_to_config, config_handler, &config) < 0) {
        fprintf(stderr, "Can't load '%s'.\n", path_to_config);
        free(path_to_config);
        return 1;
    }

    printf("Launching workers...\n");

    if (setup_workers(&config, &mq) == -1) {
        goto out;
    }

    while (!atomic_load(&shutdown_requested)) {
        sleep(1);
    }

    stop_workers(&config);

    lfqueue_destroy(&mq);
out:
    free(path_to_config);
    deinit_config(&config);
    return 0;
}
