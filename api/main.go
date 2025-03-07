package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/koltiradw/TrafficInspector/api/db"
	"github.com/koltiradw/TrafficInspector/api/routes"
)

func main() {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	db := db.InitDb()
	api_endpoint := os.Getenv("API_ENDPOINT")
	server := &http.Server{
		Addr:    api_endpoint,
		Handler: routes.FlowRoutes(r, db),
	}

	log.Printf("[info] start http server listening %s", api_endpoint)

	err := server.ListenAndServe()

	if err != nil {
		log.Printf("Server err: %v", err)
	}
}
