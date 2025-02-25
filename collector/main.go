package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
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

const size_of_queue = 1000

type FlowInfo struct {
	SrcIp          string                 `json:"src_ip"`
	DstIp          string                 `json:"dest_ip"`
	SrcPort        uint16                 `json:"src_port"`
	DstPort        uint16                 `json:"dst_port"`
	IpV            uint8                  `json:"ip"`
	TcpFingerprint string                 `json:"tcp_fingerprint"`
	Proto          string                 `json:"proto"`
	SrcCountry     string                 `json:"src_country"`
	DstCountry     string                 `json:"dst_country"`
	SrcAS          string                 `json:"src_as"`
	DstAS          string                 `json:"dst_as"`
	FirstSeen      string                 `json:"first_seen"`
	LastSeen       string                 `json:"last_seen"`
	NumPkts        uint64                 `json:"num_pkts"`
	LenPkts        uint64                 `json:"len_pkts"`
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
	query := `INSERT INTO flow_info (src_ip, 
					dst_ip,
					src_port,
					dst_port,
					ipv,
					tcp_fingerprint,
					proto,
					src_country,
					dst_country,
					src_as,
					dst_as,
					first_seen,
					last_seen,
					num_pkts,
					len_pkts,
					ndpi
					) 
				VALUES (@src_ip,
					@dst_ip,
					@src_port,
					@dst_port,
					@ipv,
					@tcp_fingerprint,
					@proto,
					@src_country,
					@dst_country,
					@src_as,
					@dst_as,
					@first_seen,
					@last_seen,
					@num_pkts,
					@len_pkts,
					@ndpi
					)`
	dpi, err := json.Marshal(info.Ndpi)

	if err != nil {
		return fmt.Errorf("unable to convert: %w", err)
	}

	args := pgx.NamedArgs{
		"src_ip":          info.SrcIp,
		"dst_ip":          info.DstIp,
		"src_port":        info.SrcPort,
		"dst_port":        info.DstPort,
		"ipv":             info.IpV,
		"tcp_fingerprint": info.TcpFingerprint,
		"proto":           info.Proto,
		"src_country":     info.SrcCountry,
		"dst_country":     info.DstCountry,
		"src_as":          info.SrcAS,
		"dst_as":          info.DstAS,
		"first_seen":      info.FirstSeen,
		"last_seen":       info.LastSeen,
		"num_pkts":        info.NumPkts,
		"len_pkts":        info.LenPkts,
		"ndpi":            string(dpi),
	}
	_, err = pg.db.Exec(ctx, query, args)
	if err != nil {
		return fmt.Errorf("unable to insert row: %w", err)
	}

	return nil
}

func (pg *postgres) UpgradeFlowInfo(ctx context.Context, info FlowInfo, id int) (err error) {
	query := `UPDATE flow_info SET last_seen = @last_seen,
					num_pkts = @num_pkts,
					len_pkts = @len_pkts,
					ndpi = @ndpi 
					WHERE id = @id`

	args := pgx.NamedArgs{
		"last_seen": info.LastSeen,
		"num_pkts":  info.NumPkts,
		"len_pkts":  info.LenPkts,
		"ndpi":      info.Ndpi,
		"id":        id,
	}

	_, err = pg.db.Exec(ctx, query, args)
	if err != nil {
		return fmt.Errorf("unable to update row: %w", err)
	}

	return nil
}

func (pg *postgres) GetFlowID(ctx context.Context, info FlowInfo) int {
	query := `SELECT id FROM flow_info WHERE src_ip = @src_ip AND
						dst_ip = @dst_ip AND 
						src_port = @src_port AND
						dst_port = @dst_port AND
						ndpi->>'proto' = @proto`
	args := pgx.NamedArgs{
		"src_ip":   info.SrcIp,
		"dst_ip":   info.DstIp,
		"src_port": info.SrcPort,
		"dst_port": info.DstPort,
		"proto":    info.Ndpi["proto"],
	}

	row := pg.db.QueryRow(ctx, query, args)

	var id int
	err := row.Scan(&id)
	if err != nil {
		return 0
	}

	return id
}

func server(ctx context.Context, endpoint string, pg *postgres) (err error) {
	puller, err := zmq.NewSocket(zmq.PULL)
	if err != nil {
		return err
	}
	defer puller.Close()

	err = puller.SetRcvhwm(size_of_queue)
	if err != nil {
		return err
	}

	err = puller.Connect(endpoint)
	if err != nil {
		return err
	}

	doneChan := make(chan error, 1)

	go func() {
		for {
			msg, err := puller.Recv(0)
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
			id := pg.GetFlowID(ctx, info)

			if id != 0 {
				err = pg.UpgradeFlowInfo(ctx, info, id)

				if err != nil {
					doneChan <- err
					return
				}
			} else {

				err = pg.InsertFlowInfo(ctx, info)

				if err != nil {
					doneChan <- err
					return
				}
			}
		}
	}()

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

	err = server(ctx, os.Getenv("ZMQ_ENDPOINT"), pg)

	if err != nil {
		fmt.Fprintf(os.Stderr, "%v\n", err)
		os.Exit(1)
	}
}
