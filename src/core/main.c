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
#include "message_queue.h"
#include "ndpi_workflow.h"

#define MATCH(s, n) strcmp(section, s) == 0 && strcmp(name, n) == 0

const char* HELP = "TrafficInspector - simple packet inspection solution based on nDPI\n"
                   "\t-h           Help\n"
                   "\t-c path      Path to config file.\n";

typedef struct {
    uint8_t number_of_workers;
    char* name_of_device;
    char* collector_host;
    int collector_port;
    char* path_to_country_db;
    char* path_to_asn_db;
} config_t;

void
init_config(config_t* config) {
    config->number_of_workers = 0;
    config->name_of_device = NULL;
    config->collector_host = NULL;
    config->collector_port = 0;
    config->path_to_country_db = NULL;
    config->path_to_asn_db = NULL;
}

static worker_t* workers = NULL;

static atomic_bool shutdown_requested = false;

static void*
run_worker(void* args) {
    worker_t* worker = (worker_t*)args;
    printf("Starting thread [%d]\n", worker->id);
    run_afpacket_loop(worker->workflow->handle, ndpi_process_packet, (uint8_t*)worker);
    return NULL;
}

static int
config_handler(void* user, const char* section, const char* name, const char* value) {
    config_t* config = (config_t*)user;
    if (MATCH("common", "workers")) {
        config->number_of_workers = atoi(value);
    } else if (MATCH("common", "device")) {
        config->name_of_device = strdup(value);
    } else if (MATCH("common", "collector_host")) {
        config->collector_host = strdup(value);
    } else if (MATCH("common", "collector_port")) {
        config->collector_port = atoi(value);
    } else if (MATCH("geoip", "country")) {
        config->path_to_country_db = strdup(value);
    } else if (MATCH("geoip", "asn")) {
        config->path_to_asn_db = strdup(value);
    } else {
        return -1;
    }
    return 1;
}

static void
sig_handler(int sig) {
    (void)sig;
    atomic_store(&shutdown_requested, true);
}

static int
setup_workers(const config_t* config, mqueue_t* mq) {
    struct sigaction action;
    action.sa_handler = sig_handler;
    sigemptyset(&action.sa_mask);
    action.sa_flags = 0;
    sigaction(SIGINT, &action, NULL);

    int fanout_group_id = getpid() & 0xffff;

    if (!(workers = (worker_t*)calloc(config->number_of_workers, sizeof(worker_t)))) {
        fprintf(stderr, "Failed to allocate workers\n");
        return -1;
    }

    for (int i = 0; i < config->number_of_workers; i++) {
        workers[i].id = i;
        workers[i].number_of_workers = config->number_of_workers;
        workers[i].message_queue = mq;
        if (!(workers[i].workflow = init_workflow(config->name_of_device, fanout_group_id, config->path_to_country_db,
                                                  config->path_to_asn_db))) {
            free(workers);
            fprintf(stderr, "Failed to allocate workflow\n");
            return -1;
        }
    }

    for (int i = 0; i < config->number_of_workers; i++) {
        pthread_create(&workers[i].thread, NULL, run_worker, (void*)&workers[i]);
    }
    return 0;
}

static void
stop_workers(const config_t* config) {
    for (int i = 0; i < config->number_of_workers; i++) {
        pthread_kill(workers[i].thread, SIGINT);
        pthread_join(workers[i].thread, NULL);
        free_workflow(&workers[i].workflow);
    }
}

int
main(int argc, char** argv) {
    int option = -1;
    config_t config;
    char* path_to_config = NULL;
    mqueue_t mq;
    collector_client_t* client = NULL;

    pthread_mutexattr_t attr;
    pthread_mutexattr_init(&attr);
    pthread_mutexattr_settype(&attr, PTHREAD_MUTEX_RECURSIVE);
    pthread_mutex_init(&mq.mtx, &attr);
    pthread_cond_init(&mq.cond, NULL);
    TAILQ_INIT(&mq.tailq);

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

    init_config(&config);

    if (ini_parse(path_to_config, config_handler, &config) < 0) {
        fprintf(stderr, "Can't load '%s'.\n", path_to_config);
        free(path_to_config);
        return 1;
    }

    if (!(client = init_collector_client(config.collector_host, config.collector_port))) {
        return 1;
    }

    printf("Launching workers...\n");

    if (setup_workers(&config, &mq) == -1) {
        goto out;
    }
    char* data = NULL;
    size_t len = 0;
    while (!atomic_load(&shutdown_requested)) {
        pthread_mutex_lock(&mq.mtx);
        pthread_cond_wait(&mq.cond, &mq.mtx);
        if (!TAILQ_EMPTY(&mq.tailq)) {
            struct entry* msg = TAILQ_FIRST(&mq.tailq);

            len = strlen(msg->flow_data);
            data = malloc((len) + 1);
            memcpy(data, msg->flow_data, len);
            data[len] = '\0';

            free((char*)msg->flow_data);
            msg->flow_data = NULL;

            TAILQ_REMOVE(&mq.tailq, msg, entries);
            pthread_mutex_unlock(&mq.mtx);
            send_to_collector(client, data, len);
            free(data);
        }
    }

    stop_workers(&config);
    close_collector_client(client);
out:
    pthread_mutex_destroy(&mq.mtx);
    pthread_cond_destroy(&mq.cond);
    free(path_to_config);
    free(config.name_of_device);
    free(config.collector_host);
    free(config.path_to_country_db);
    free(config.path_to_asn_db);
    return 0;
}
