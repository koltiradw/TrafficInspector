package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type FlowInfo struct {
	Id             uuid.UUID      `gorm:"primaryKey;column:id" json:"id"`
	SrcMac         string         `json:"src_mac"`
	DstMac         string         `json:"dst_mac"`
	SrcIp          string         `json:"src_ip"`
	DstIp          string         `json:"dest_ip"`
	SrcPort        uint16         `json:"src_port"`
	DstPort        uint16         `json:"dst_port"`
	IpV            uint8          `json:"ip"`
	TcpFingerprint string         `json:"tcp_fingerprint"`
	SrcOS          string         `json:"src_os"`
	DstOS          string         `json:"dst_os"`
	Proto          string         `json:"proto"`
	SrcCountry     string         `json:"src_country"`
	DstCountry     string         `json:"dst_country"`
	SrcAS          string         `json:"src_as"`
	DstAS          string         `json:"dst_as"`
	FirstSeen      time.Time      `json:"first_seen"`
	LastSeen       time.Time      `json:"last_seen"`
	SrcNumPkts     uint64         `json:"src_num_pkts"`
	DstNumPkts     uint64         `json:"dst_num_pkts"`
	SrcLenPkts     uint64         `json:"src_len_pkts"`
	DstLenPkts     uint64         `json:"dst_len_pkts"`
	Ndpi           datatypes.JSON `gorm:"type:jsonb" json:"ndpi"`
}

type FlowPreview struct {
	Id         uuid.UUID `gorm:"primaryKey;column:id" json:"id"`
	LastSeen   time.Time `json:"last_seen"`
	SrcIp      string    `json:"src_ip"`
	DstIp      string    `json:"dst_ip"`
	SrcCountry string    `json:"src_country"`
	DstCountry string    `json:"dst_country"`
	Protocol   string    `gorm:"column:protocol" json:"protocol"`
	Category   string    `gorm:"column:category" json:"category"`
}

type Pagination struct {
	CurrentPage int   `json:"current_page"`
	Limit       int   `json:"limit"`
	TotalFlows  int64 `json:"total_flows"`
	TotalPages  int   `json:"total_pages"`
	NextPage    int   `json:"next_page,omitempty"`
	PrevPage    int   `json:"prev_page,omitempty"`
}

type FlowPreviewResponse struct {
	Data       []FlowPreview `json:"data"`
	Pagination Pagination    `json:"pagination"`
}

func GetFlowInfo(db *gorm.DB, id uuid.UUID) (*FlowInfo, error) {
	var flow_info FlowInfo
	err := db.First(&flow_info, "id = ?", id).Error

	return &flow_info, err
}

func GetFlowsPreview(db *gorm.DB, limit int, offset int) (*FlowPreviewResponse, error) {
	var totalFlows int64
	db.Model(&FlowInfo{}).Count(&totalFlows)

	totalPages := (int(totalFlows) + limit - 1) / limit

	var flows []FlowPreview
	err := db.Model(&FlowInfo{}).Order("last_seen DESC").Offset(offset).Limit(limit).
		Select(
			"id",
			"last_seen",
			"src_ip",
			"dst_ip",
			"src_country",
			"dst_country",
			"ndpi->>'proto' AS protocol",
			"ndpi->>'category' AS category",
		).
		Find(&flows).Error

	if err != nil {
		return nil, err
	}

	response := FlowPreviewResponse{
		Pagination: Pagination{
			Limit:      limit,
			TotalFlows: totalFlows,
			TotalPages: totalPages,
		},
		Data: flows,
	}

	return &response, nil
}
