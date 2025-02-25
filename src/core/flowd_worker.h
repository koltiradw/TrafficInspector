#ifndef __FLOWD_WORKER_H__
#define __FLOWD_WORKER_H__

#include <pthread.h>

#include "lfqueue.h"

typedef struct {
    pthread_t thread;
    lfqueue_t* message_queue;
    void* ctx;
    void* pusher;
} flowd_worker_t;

flowd_worker_t* init_flowd_worker(const char* endpoint, lfqueue_t* mq);
void deinit_flowd_worker(flowd_worker_t* worker);
void* run_flowd_worker(void* args);

#endif /* __FLOWD_WORKER__ */