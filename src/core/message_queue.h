#ifndef __MESSAGE_QUEUE_H__
#define __MESSAGE_QUEUE_H__

#include <pthread.h>
#include <sys/queue.h>

struct entry {
    TAILQ_ENTRY(entry) entries;
    const char* flow_data;
};

TAILQ_HEAD(queue, entry);

typedef struct {
    struct queue tailq;
    pthread_mutex_t mtx;
    pthread_cond_t cond;
} mqueue_t;

#endif /* __MESSAGE_QUEUE_H__ */