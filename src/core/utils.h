#ifndef __UTILS_H__
#define __UTILS_H__

#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <time.h>

static inline bool
is_private_ipv4(uint32_t ip_addr) {
    return (
        // 10.0.0.0/8 (mask 255.0.0.0)
        (ip_addr & 0xFF000000) == 0x0A000000 ||

        // 172.16.0.0/12 (mask 255.240.0.0)
        (ip_addr & 0xFFF00000) == 0xAC100000 ||

        // 192.168.0.0/16 (mask 255.255.0.0)
        (ip_addr & 0xFFFF0000) == 0xC0A80000);
}

static inline bool
is_private_ipv6(uint64_t ip_addr) {
    return ((const uint8_t*)&ip_addr)[7] == 0xfd;
}

void convert_timestamp_to_datetime(const time_t timestamp, char* datetime, size_t len);

void mac_to_string(const uint8_t* mac, char* str);

uint64_t get_current_time_ms();

#endif /* __UTILS__ */