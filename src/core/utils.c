#include <string.h>

#include "utils.h"

void
convert_timestamp_to_datetime(const time_t timestamp, char* datetime, size_t len) {
    struct tm* tm = NULL;
    if ((tm = localtime(&timestamp))) {
        strftime(datetime, len, "%Y-%m-%dT%H:%M:%S", tm);
    }
    return;
}

void
mac_to_string(const uint8_t* mac, char* str) {
    sprintf(str, "%02X:%02X:%02X:%02X:%02X:%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    return;
}

uint64_t
get_current_time_ms() {
    struct timespec ts;
    if (timespec_get(&ts, TIME_UTC)) {
        // Calculate milliseconds: seconds * 1000 + nanoseconds / 1,000,000
        return (uint64_t)ts.tv_sec * 1000 + ts.tv_nsec / 1000000;
    }
    return 0;
}