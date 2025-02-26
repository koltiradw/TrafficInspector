#ifndef __ZMQ_LOG_H__
#define __ZMQ_LOG_H__

#include <pthread.h>

typedef struct {
    void* ctx;
    void* pusher;
} zmq_log_t;

zmq_log_t* init_zmq_log(const char* endpoint);
void deinit_zmq_log(zmq_log_t* socket);

#endif /* __ZMQ_LOG__ */