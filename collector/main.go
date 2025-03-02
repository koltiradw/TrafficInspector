package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"sync"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	zmq "github.com/pebbe/zmq4"
)

type postgres struct {
	db *pgxpool.Pool
}

var (
	pgInstance *postgres
	pgOnce     sync.Once
)

type FlowInfo struct {
	Id             string                 `json:"uuid"`
	SrcIp          string                 `json:"src_ip"`
	DstIp          string                 `json:"dest_ip"`
	SrcPort        uint16                 `json:"src_port"`
	DstPort        uint16                 `json:"dst_port"`
	IpV            uint8                  `json:"ip"`
	TcpFingerprint string                 `json:"tcp_fingerprint"`
	ClientOS       string                 `json:"client_os"`
	ServerOS       string                 `json:"server_os"`
	Proto          string                 `json:"proto"`
	SrcCountry     string                 `json:"src_country"`
	DstCountry     string                 `json:"dst_country"`
	SrcAS          string                 `json:"src_as"`
	DstAS          string                 `json:"dst_as"`
	FirstSeen      string                 `json:"first_seen"`
	LastSeen       string                 `json:"last_seen"`
	ClientNumPkts  uint64                 `json:"client_num_pkts"`
	ServertNumPkts uint64                 `json:"server_num_pkts"`
	ClientLenPkts  uint64                 `json:"client_len_pkts"`
	ServerLenPkts  uint64                 `json:"server_len_pkts"`
	Ndpi           map[string]interface{} `json:"ndpi"`
}

func NewPG(ctx context.Context, connString string) (*postgres, error) {
	pgOnce.Do(func() {
		db, err := pgxpool.New(ctx, connString)
		if err != nil {
			return
		}

		pgInstance = &postgres{db}
	})

	return pgInstance, nil
}

func (pg *postgres) Ping(ctx context.Context) error {
	return pg.db.Ping(ctx)
}

func (pg *postgres) Close() {
	pg.db.Close()
}

func (pg *postgres) InsertFlowInfo(ctx context.Context, info FlowInfo) (err error) {
	query := `INSERT INTO flow_info (id,
					src_ip, 
					dst_ip,
					src_port,
					dst_port,
					ipv,
					tcp_fingerprint,
					client_os,
					server_os,
					proto,
					src_country,
					dst_country,
					src_as,
					dst_as,
					first_seen,
					last_seen,
					client_num_pkts,
					server_num_pkts,
					client_len_pkts,
					server_len_pkts,
					ndpi
					) 
				VALUES (@id,
					@src_ip,
					@dst_ip,
					@src_port,
					@dst_port,
					@ipv,
					@tcp_fingerprint,
					@client_os,
					@server_os,
					@proto,
					@src_country,
					@dst_country,
					@src_as,
					@dst_as,
					@first_seen,
					@last_seen,
					@client_num_pkts,
					@server_num_pkts,
					@client_len_pkts,
					@server_len_pkts,
					@ndpi) 
				ON CONFLICT (id) DO UPDATE
				SET last_seen = @last_seen,
					client_num_pkts = @client_num_pkts,
					server_num_pkts = @server_num_pkts,
					client_len_pkts = @client_len_pkts,
					server_len_pkts = @server_len_pkts,
					ndpi = @ndpi;`
	dpi, err := json.Marshal(info.Ndpi)

	if err != nil {
		return fmt.Errorf("unable to convert: %w", err)
	}

	args := pgx.NamedArgs{
		"id":              info.Id,
		"src_ip":          info.SrcIp,
		"dst_ip":          info.DstIp,
		"src_port":        info.SrcPort,
		"dst_port":        info.DstPort,
		"ipv":             info.IpV,
		"tcp_fingerprint": info.TcpFingerprint,
		"client_os":       info.ClientOS,
		"server_os":       info.ServerOS,
		"proto":           info.Proto,
		"src_country":     info.SrcCountry,
		"dst_country":     info.DstCountry,
		"src_as":          info.SrcAS,
		"dst_as":          info.DstAS,
		"first_seen":      info.FirstSeen,
		"last_seen":       info.LastSeen,
		"client_num_pkts": info.ClientNumPkts,
		"server_num_pkts": info.ServertNumPkts,
		"client_len_pkts": info.ClientLenPkts,
		"server_len_pkts": info.ServerLenPkts,
		"ndpi":            string(dpi),
	}
	_, err = pg.db.Exec(ctx, query, args)
	if err != nil {
		return fmt.Errorf("unable to insert row: %w", err)
	}

	return nil
}

func server(ctx context.Context, endpoint string, num_of_endpoints int, pg *postgres) (err error) {
	pullers := make([]*zmq.Socket, num_of_endpoints)
	default_port := 5556

	for i := 0; i < num_of_endpoints; i++ {
		puller, err := zmq.NewSocket(zmq.PULL)
		if err != nil {
			return err
		}
		defer puller.Close()

		zmq_endpoint := fmt.Sprintf("%s:%d", endpoint, default_port)
		fmt.Println(zmq_endpoint)
		err = puller.Connect(zmq_endpoint)
		if err != nil {
			return err
		}
		pullers[i] = puller
		default_port++
	}
	doneChan := make(chan error, 1)

	for i := 0; i < num_of_endpoints; i++ {
		go func() {
			for {
				msg, err := pullers[i].Recv(0)
				if err != nil {
					doneChan <- err
					continue
				}

				var info FlowInfo
				err = json.Unmarshal([]byte(msg), &info)
				if err != nil {
					doneChan <- err
					return
				}

				err = pg.InsertFlowInfo(ctx, info)

				if err != nil {
					doneChan <- err
					return
				}
			}
		}()
	}

	select {
	case <-ctx.Done():
		fmt.Println("cancelled")
		err = ctx.Err()
	case err = <-doneChan:
	}

	return
}

func main() {
	ctx := context.Background()
	pg, err := NewPG(ctx, os.Getenv("POSTGRES_URL"))

	if err != nil {
		fmt.Fprintf(os.Stderr, "%v\n", err)
		os.Exit(1)
	}

	defer pg.Close()

	num_of_endpoints, err := strconv.Atoi(os.Getenv("NUM_OF_ENDPOINTS"))

	if err != nil {
		fmt.Fprintf(os.Stderr, "%v\n", err)
		os.Exit(1)
	}

	err = server(ctx, os.Getenv("ZMQ_ENDPOINT"), num_of_endpoints, pg)

	if err != nil {
		fmt.Fprintf(os.Stderr, "%v\n", err)
		os.Exit(1)
	}
}
