package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/koltiradw/TrafficInspector/api/controllers"
	"gorm.io/gorm"
)

func FlowRoutes(r *gin.Engine, db *gorm.DB) *gin.Engine {
	flowsRepo := controllers.FlowsRepo{
		Db: db,
	}

	v1Flows := r.Group("/api/v1/flows")
	{
		v1Flows.GET("/all", flowsRepo.GetAllFlows)
		v1Flows.GET("/:id", flowsRepo.GetFlowById)
	}

	return r
}
