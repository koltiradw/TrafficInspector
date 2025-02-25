cmake_minimum_required(VERSION 3.28)
include(ExternalProject)

set(CMAKE_C_COMPILER /usr/bin/clang)
set(CMAKE_CXX_COMPILER /usr/bin/clang++)

project(TrafficInspector)

set(NDPI_INSTALL_DIR "${CMAKE_CURRENT_BINARY_DIR}/libndpi")
set(NDPI_SRC_DIR "${CMAKE_CURRENT_SOURCE_DIR}/third_party/libndpi")
set(NDPI_LIB "${NDPI_INSTALL_DIR}/lib/libndpi.a")

set(INIH_SRC_DIR "${CMAKE_CURRENT_SOURCE_DIR}/third_party/libinih")

set(LFQUEUE_SRC_DIR "${CMAKE_CURRENT_SOURCE_DIR}/third_party/lfqueue")

set(MAXMINDDB_INSTALL_DIR "${CMAKE_CURRENT_BINARY_DIR}/libmaxminddb")
set(MAXMINDDB_SRC_DIR "${CMAKE_CURRENT_SOURCE_DIR}/third_party/libmaxminddb")
set(MAXMINDDB_LIB "${MAXMINDDB_INSTALL_DIR}/lib/libmaxminddb.a")

set(PCAP_INSTALL_DIR "${CMAKE_CURRENT_BINARY_DIR}/libpcap")
set(PCAP_SRC_DIR "${CMAKE_CURRENT_SOURCE_DIR}/third_party/libpcap")
set(PCAP_LIB "${PCAP_INSTALL_DIR}/lib/libpcap.a")


include_directories("${NDPI_INSTALL_DIR}/include/ndpi/")
include_directories("${INIH_SRC_DIR}")
include_directories("${LFQUEUE_SRC_DIR}")

if(DEBUG)
	set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -Wall -Werror -g -O0 -fno-omit-frame-pointer -flto -fsanitize=address")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -fuse-ld=gold -fsanitize=address")
endif(DEBUG)

if(RELEASE)
	set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -Wall -Werror -O2 -std=gnu11 -flto")
	set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -fuse-ld=gold")
endif(RELEASE)

ExternalProject_Add(libmaxminddb
    SOURCE_DIR ${MAXMINDDB_SRC_DIR}
    CONFIGURE_COMMAND cd ${MAXMINDDB_SRC_DIR} && ./bootstrap && ./configure --prefix=${MAXMINDDB_INSTALL_DIR} CC=${CMAKE_C_COMPILER}
    BUILD_COMMAND cd ${MAXMINDDB_SRC_DIR} && $(MAKE)
    INSTALL_COMMAND cd ${MAXMINDDB_SRC_DIR} && $(MAKE) install
)

ExternalProject_Add(libpcap
    SOURCE_DIR ${PCAP_SRC_DIR}
    CONFIGURE_COMMAND cd ${PCAP_SRC_DIR} && ./autogen.sh && ./configure --prefix=${PCAP_INSTALL_DIR} --enable-dbus=no --enable-rdma=no CC=${CMAKE_C_COMPILER}
    BUILD_COMMAND cd ${PCAP_SRC_DIR} && $(MAKE)
    INSTALL_COMMAND cd ${PCAP_SRC_DIR} && $(MAKE) install
)

ExternalProject_Add(libndpi
    SOURCE_DIR ${NDPI_SRC_DIR}
    CONFIGURE_COMMAND cd ${NDPI_SRC_DIR} && ./autogen.sh --with-maxminddb --with-only-libndpi --with-lto-and-gold-linker --prefix=${NDPI_INSTALL_DIR} CC=${CMAKE_C_COMPILER}
    BUILD_COMMAND cd ${NDPI_SRC_DIR} && $(MAKE)
    INSTALL_COMMAND cd ${NDPI_SRC_DIR} && $(MAKE) install
)

add_executable(TrafficInspector src/core/main.c src/core/afpacket.c src/core/ndpi_workflow.c src/core/utils.c src/core/flowd_worker.c src/core/dpi_worker.c src/core/config.c third_party/lfqueue/lfqueue.c third_party/libinih/ini.c)

target_link_libraries(TrafficInspector PUBLIC ${NDPI_LIB} ${MAXMINDDB_LIB} ${PCAP_LIB} -lpthread -lzmq -lm)
