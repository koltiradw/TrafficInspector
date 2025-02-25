#include "afpacket.h"

#include <arpa/inet.h>
#include <errno.h>
#include <linux/if_packet.h>
#include <net/ethernet.h>
#include <net/if.h>
#include <pcap/pcap.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <sys/poll.h>
#include <unistd.h>

struct block_desc {
    uint32_t version;
    uint32_t offset_to_priv;
    struct tpacket_hdr_v1 header;
};

static const int TPACKET_VERSION = TPACKET_V3;
static const int PACKET_FANOUT_TYPE = PACKET_FANOUT_CPU;

// 4194304 bytes
static const uint32_t blocksiz = 1 << 22;
// 2048 bytes
static const uint32_t framesiz = 1 << 11;
static const uint32_t blocknum = 64;

static int
__set_promisc_mode(const int socket_fd, const int interface_number) {
    struct packet_mreq sock_params;
    memset(&sock_params, 0, sizeof(sock_params));

    sock_params.mr_type = PACKET_MR_PROMISC;
    sock_params.mr_ifindex = interface_number;

    return setsockopt(socket_fd, SOL_PACKET, PACKET_ADD_MEMBERSHIP, (void*)&sock_params, sizeof(sock_params));
}

/*static int
__set_bpf_filter(const char* name_of_device, const int sockfd) {
    struct bpf_program bpf;
    pcap_t* handle = pcap_open_dead(DLT_EN10MB, 65536);

    if (pcap_compile(handle, &bpf, "ip or ip6", 1, 0) < 0) {
        pcap_close(handle);
        return -1;
    }

    if (setsockopt(sockfd, SOL_SOCKET, SO_ATTACH_FILTER, &bpf, sizeof(bpf)) < 0) {
        pcap_freecode(&bpf);
        pcap_close(handle);
        return -1;
    }

    pcap_freecode(&bpf);
    pcap_close(handle);
    return 0;
}*/

static struct iovec*
__setup_rx_ring(const int socket_fd, const struct sockaddr_ll* bind_address) {
    struct tpacket_req3 req;
    memset(&req, 0, sizeof(req));

    req.tp_block_size = blocksiz;
    req.tp_frame_size = framesiz;
    req.tp_block_nr = blocknum;
    req.tp_frame_nr = (blocksiz * blocknum) / framesiz;

    req.tp_retire_blk_tov = 60;
    req.tp_feature_req_word = TP_FT_REQ_FILL_RXHASH;

    if (setsockopt(socket_fd, SOL_PACKET, PACKET_RX_RING, (void*)&req, sizeof(req)) == -1) {
        return NULL;
    }

    uint8_t* mapped_buffer = NULL;
    struct iovec* io = NULL;

    if ((mapped_buffer = (uint8_t*)mmap(NULL, req.tp_block_size * req.tp_block_nr, PROT_READ | PROT_WRITE,
                                        MAP_SHARED | MAP_LOCKED, socket_fd, 0))
        == MAP_FAILED) {
        return NULL;
    }

    io = (struct iovec*)malloc(req.tp_block_nr * sizeof(struct iovec));

    for (int i = 0; i < req.tp_block_nr; ++i) {
        io[i].iov_base = mapped_buffer + (i * req.tp_block_size);
        io[i].iov_len = req.tp_block_size;
    }

    if (bind(socket_fd, (struct sockaddr*)bind_address, sizeof(struct sockaddr_ll)) == -1) {
        free(io);
        return NULL;
    }
    return io;
}

static int
__setup_fanout_group(const int socket_fd, const int fanout_group_id) {
    int fanout_arg = (fanout_group_id | (PACKET_FANOUT_TYPE << 16));
    if (setsockopt(socket_fd, SOL_PACKET, PACKET_FANOUT, &fanout_arg, sizeof(fanout_arg))) {
        return -1;
    }
    return 0;
}

afpacket_t*
open_afpacket_socket(const char* name_of_device, const int fanout_group_id) {
    afpacket_t* handle = NULL;
    if ((handle = (afpacket_t*)calloc(1, sizeof(afpacket_t))) == NULL) {
        return NULL;
    }

    if ((handle->socket_fd = socket(AF_PACKET, SOCK_RAW, htons(ETH_P_ALL))) == -1) {
        free(handle);
        return NULL;
    }

    /*if (__set_bpf_filter(name_of_device, handle->socket_fd) == -1) {
        fprintf(stderr, "Failed to set bpf filter to device\n");
        close(handle->socket_fd);
        free(handle);
        return NULL;
    }*/

    if (setsockopt(handle->socket_fd, SOL_PACKET, PACKET_VERSION, &TPACKET_VERSION, sizeof(TPACKET_VERSION)) == -1) {
        close(handle->socket_fd);
        free(handle);
        return NULL;
    }

    int interface_number = if_nametoindex(name_of_device);

    if (interface_number == -1) {
        close(handle->socket_fd);
        free(handle);
        return NULL;
    }

    if (__set_promisc_mode(handle->socket_fd, interface_number) == -1) {
        close(handle->socket_fd);
        free(handle);
        return NULL;
    }

    struct sockaddr_ll bind_address;
    memset(&bind_address, 0, sizeof(bind_address));

    bind_address.sll_family = AF_PACKET;
    bind_address.sll_protocol = htons(ETH_P_ALL);
    bind_address.sll_ifindex = interface_number;

    if ((handle->io = __setup_rx_ring(handle->socket_fd, &bind_address)) == NULL) {
        close(handle->socket_fd);
        free(handle);
        return NULL;
    }

    if (__setup_fanout_group(handle->socket_fd, fanout_group_id) == -1) {
        close(handle->socket_fd);
        free(handle->io);
        free(handle);
        return NULL;
    }
    return handle;
}

static void
__process_block(struct block_desc* pbd, const int block_num, packet_handler callback, const uint8_t* user_data) {
    int num_pkts = pbd->header.num_pkts, i;
    struct tpacket3_hdr* ppd;

    ppd = (struct tpacket3_hdr*)((uint8_t*)pbd + pbd->header.offset_to_first_pkt);
    for (i = 0; i < num_pkts; ++i) {
        struct afpacket_pkthdr packet_header;
        memset(&packet_header, 0, sizeof(packet_header));
        packet_header.len = ppd->tp_snaplen;
        packet_header.caplen = ppd->tp_snaplen;
        packet_header.ts.tv_sec = ppd->tp_sec;
        packet_header.ts.tv_usec = ppd->tp_nsec / 1000;

        uint8_t* data_pointer = ((uint8_t*)ppd + ppd->tp_mac);

        callback(user_data, &packet_header, data_pointer);

        ppd = (struct tpacket3_hdr*)((uint8_t*)ppd + ppd->tp_next_offset);
    }
}

void
run_afpacket_loop(afpacket_t* handle, packet_handler callback, const uint8_t* user_data) {
    uint32_t current_block_num = 0;
    int ret = 0;
    struct pollfd pfd;
    memset(&pfd, 0, sizeof(pfd));

    pfd.fd = handle->socket_fd;
    pfd.events = POLLIN | POLLERR;
    pfd.revents = 0;
    while (true) {
        struct block_desc* pbd = (struct block_desc*)handle->io[current_block_num].iov_base;

        if ((pbd->header.block_status & TP_STATUS_USER) == 0) {
            ret = poll(&pfd, 1, -1);
            if (ret == -1) {
                if (errno == EINTR) {
                    return;
                }
            }
            continue;
        }
        __process_block(pbd, current_block_num, callback, user_data);
        pbd->header.block_status = TP_STATUS_KERNEL;
        current_block_num = (current_block_num + 1) % blocknum;
    }
}

void
afpacket_close(afpacket_t* handle) {
    close(handle->socket_fd);
    free(handle->io);
    free(handle);
}
