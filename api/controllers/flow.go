package controllers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/koltiradw/TrafficInspector/api/models"
	"gorm.io/gorm"

	"github.com/google/uuid"
)

type FlowsRepo struct {
	Db *gorm.DB
}

func (repository *FlowsRepo) GetFlowById(c *gin.Context) {
	raw_id := c.Param("id")
	id, err := uuid.Parse(raw_id)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	flow_info, err := models.GetFlowInfo(repository.Db, id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	c.JSON(http.StatusOK, flow_info)
}

func (repository *FlowsRepo) GetAllFlows(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	if page < 1 || limit < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid pagination parameters"})
		return
	}

	offset := (page - 1) * limit

	flow_preview, err := models.GetFlowsPreview(repository.Db, limit, offset)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	flow_preview.Pagination.CurrentPage = page
	if page < flow_preview.Pagination.TotalPages {
		flow_preview.Pagination.NextPage = page + 1
	}

	if page > 1 {
		flow_preview.Pagination.PrevPage = page - 1
	}

	c.JSON(http.StatusOK, flow_preview)
}
