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