#include <stdlib.h>

#include "config.h"

int
config_handler(void* user, const char* section, const char* name, const char* value) {
    config_t* config = (config_t*)user;
    if (MATCH("common", "workers")) {
        config->number_of_workers = atoi(value);
    } else if (MATCH("common", "device")) {
        config->name_of_device = strdup(value);
    } else if (MATCH("common", "flowd_endpoint")) {
        config->flowd_endpoint = strdup(value);
    } else if (MATCH("geoip", "country")) {
        config->path_to_country_db = strdup(value);
    } else if (MATCH("geoip", "asn")) {
        config->path_to_asn_db = strdup(value);
    } else {
        return -1;
    }
    return 1;
}

void
deinit_config(config_t* config) {
    free(config->name_of_device);
    free(config->flowd_endpoint);
    free(config->path_to_country_db);
    free(config->path_to_asn_db);
}