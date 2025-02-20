#include <string.h>

#include "utils.h"

void
convert_timestamp_to_datetime(const time_t timestamp, char* datetime, size_t len) {
    struct tm buf;
    if (localtime_r(&timestamp, &buf)) {
        strftime(datetime, len, "%Y-%m-%dT%H:%M:%S", &buf);
    }
    return;
}