#include "zmq_log.h"

#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

#include <zmq.h>

const int MAX_SIZE_OF_QUEUE = 1000;

zmq_log_t*
init_zmq_log(const char* endpoint) {
    zmq_log_t* socket = NULL;

    if (!(socket = (zmq_log_t*)calloc(1, sizeof(zmq_log_t)))) {
        return NULL;
    }

    socket->ctx = zmq_ctx_new();
    if (!socket->ctx) {
        free(socket);
        return NULL;
    }

    socket->pusher = zmq_socket(socket->ctx, ZMQ_PUSH);
    zmq_setsockopt(socket->pusher, ZMQ_SNDHWM, &MAX_SIZE_OF_QUEUE, sizeof(MAX_SIZE_OF_QUEUE));
    zmq_bind(socket->pusher, endpoint);

    return socket;
}

void
deinit_zmq_log(zmq_log_t* socket) {
    zmq_close(socket->pusher);
    zmq_ctx_term(socket->ctx);
    free(socket);
}