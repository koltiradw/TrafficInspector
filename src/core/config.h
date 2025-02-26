#ifndef __CONFIG_H__
#define __CONFIG_H__

#include <stdint.h>
#include <string.h>

typedef struct {
    uint8_t number_of_workers;
    char* name_of_device;
    char* zmq_endpoint;
    char* path_to_country_db;
    char* path_to_asn_db;
} config_t;

#define MATCH(s, n) strcmp(section, s) == 0 && strcmp(name, n) == 0

int config_handler(void* user, const char* section, const char* name, const char* value);

void deinit_config(config_t* config);

#endif /* __CONFIG__ */