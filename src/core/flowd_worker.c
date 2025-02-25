#include "flowd_worker.h"

#include <errno.h>
#include <stdbool.h>
#include <string.h>
#include <unistd.h>

#include <zmq.h>

const int MAX_SIZE_OF_QUEUE = 1000;

flowd_worker_t*
init_flowd_worker(const char* endpoint, lfqueue_t* mq) {
    flowd_worker_t* worker = NULL;

    if (!(worker = (flowd_worker_t*)calloc(1, sizeof(flowd_worker_t)))) {
        return NULL;
    }

    worker->ctx = zmq_ctx_new();
    if (!worker->ctx) {
        return NULL;
    }

    worker->pusher = zmq_socket(worker->ctx, ZMQ_PUSH);
    zmq_setsockopt(worker->pusher, ZMQ_SNDHWM, &MAX_SIZE_OF_QUEUE, sizeof(MAX_SIZE_OF_QUEUE));
    zmq_bind(worker->pusher, endpoint);

    worker->message_queue = mq;
    return worker;
}

void*
run_flowd_worker(void* args) {
    flowd_worker_t* worker = (flowd_worker_t*)args;

    char* data = NULL;
    while (true) {
        if ((data = lfqueue_deq(worker->message_queue))) {
            while (zmq_send(worker->pusher, data, strlen(data), ZMQ_DONTWAIT) == -1) {
                if (errno == EAGAIN) {
                    usleep(1000);
                    continue;
                }
                break;
            }
            free(data);
        }
    }

    return NULL;
}

void
deinit_flowd_worker(flowd_worker_t* worker) {
    zmq_close(worker->pusher);
    zmq_ctx_term(worker->ctx);
    free(worker);
}