// Package main provides the entry point for the Notification Service
//
// This service handles multi-channel notifications including:
// - Email notifications (via SendGrid/AWS SES)
// - SMS notifications (via Twilio)
// - Push notifications (via FCM/APNs)
// - In-app notifications (via WebSocket)
// - Notification preferences and delivery tracking

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gin-contrib/cors"
	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"

	"github.com/autoclaude/notification-service/internal/config"
	"github.com/autoclaude/notification-service/internal/database"
	"github.com/autoclaude/notification-service/internal/handlers"
	"github.com/autoclaude/notification-service/internal/middleware"
	"github.com/autoclaude/notification-service/internal/models"
	"github.com/autoclaude/notification-service/internal/notifier"
	"github.com/autoclaude/notification-service/internal/queue"
	"github.com/autoclaude/notification-service/internal/repository"
	"github.com/autoclaude/notification-service/internal/service"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found: %v", err)
	}

	// Load configuration
	cfg := config.Load()

	// Initialize OpenTelemetry (if enabled)
	if cfg.Tracing.Enabled {
		if err := initTracing(cfg); err != nil {
			log.Fatalf("Failed to initialize tracing: %v", err)
		}
	}

	// Initialize database
	db, err := database.New(cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Run migrations
	if err := database.Migrate(db, &models.Notification{}, &models.NotificationTemplate{}, &models.NotificationPreference{}, &models.DeliveryReceipt{}); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize Redis
	redisClient, err := database.NewRedis(cfg.Redis)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisClient.Close()

	// Initialize repositories
	notificationRepo := repository.NewNotificationRepository(db)
	templateRepo := repository.NewTemplateRepository(db)
	preferenceRepo := repository.NewPreferenceRepository(db)
	deliveryRepo := repository.NewDeliveryRepository(db)

	// Initialize notifiers
	emailNotifier := notifier.NewEmailNotifier(cfg.Email, cfg.FromEmail, cfg.FromName)
	smsNotifier := notifier.NewSMSNotifier(cfg.Twilio)
	pushNotifier := notifier.NewPushNotifier(cfg.Push)

	// Initialize queue
	taskQueue := queue.NewTaskQueue(redisClient)

	// Initialize service
	notificationService := service.NewNotificationService(
		notificationRepo,
		templateRepo,
		preferenceRepo,
		deliveryRepo,
		emailNotifier,
		smsNotifier,
		pushNotifier,
		taskQueue,
	)

	// Start background workers
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	workerGroup := service.NewWorkerGroup(notificationService, cfg.Workers)
	workerGroup.Start(ctx)

	// Initialize handlers
	healthHandler := handlers.NewHealthHandler()
	notificationHandler := handlers.NewNotificationHandler(notificationService)
	templateHandler := handlers.NewTemplateHandler(notificationService)
	preferenceHandler := handlers.NewPreferenceHandler(notificationService)
	wsHandler := handlers.NewWebSocketHandler(notificationService)

	// Setup Gin router
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(gin.Logger())
	router.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORS.AllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Request-ID"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Middleware
	router.Use(middleware.RequestID())
	router.Use(middleware.AuthMiddleware(cfg.Auth))
	if cfg.Tracing.Enabled {
		router.Use(middleware.TracingMiddleware())
	}

	// Health check endpoints (no auth)
	router.GET("/health", healthHandler.Health)
	router.GET("/health/ready", healthHandler.Ready)
	router.GET("/health/live", healthHandler.Live)

	// Metrics endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Notification routes
		notifications := v1.Group("/notifications")
		{
			notifications.POST("", notificationHandler.Create)
			notifications.GET("", notificationHandler.List)
			notifications.GET("/:id", notificationHandler.Get)
			notifications.PUT("/:id/read", notificationHandler.MarkRead)
			notifications.DELETE("/:id", notificationHandler.Delete)
		}

		// Template routes
		templates := v1.Group("/templates")
		{
			templates.POST("", templateHandler.Create)
			templates.GET("", templateHandler.List)
			templates.GET("/:id", templateHandler.Get)
			templates.PUT("/:id", templateHandler.Update)
			templates.DELETE("/:id", templateHandler.Delete)
		}

		// Preference routes
		preferences := v1.Group("/preferences")
		{
			preferences.GET("", preferenceHandler.Get)
			preferences.PUT("", preferenceHandler.Update)
		}
	}

	// WebSocket endpoint for real-time notifications
	router.GET("/ws", middleware.AuthMiddleware(cfg.Auth), wsHandler.HandleWebSocket)

	// Start HTTP server
	srv := &http.Server{
		Addr:           fmt.Sprintf(":%s", cfg.Port),
		Handler:        router,
		ReadTimeout:     30 * time.Second,
		WriteTimeout:    30 * time.Second,
		MaxHeaderBytes:  1 << 20,
	}

	// Graceful shutdown
	go func() {
		log.Printf("Notification Service listening on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down Notification Service...")

	// Shutdown HTTP server
	ctx, cancel = context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	// Stop workers
	cancel()
	workerGroup.Stop()

	log.Println("Notification Service stopped")
}

// initTracing initializes OpenTelemetry tracing
func initTracing(cfg *config.Config) error {
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(
			sdktrace.NewSimpleSpanProcessor(),
		),
		sdktrace.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName("notification-service"),
		)),
	)

	otel.SetTracerProvider(tp)

	// Register trace exporter
	exporter, err := sdktrace.NewExportPipeline(
		sdktrace.WithCollector(
			sdktrace.WithInsecure(),
			sdktrace.WithEndpoint(cfg.Tracing.Endpoint),
		),
	)
	if err != nil {
		return fmt.Errorf("failed to create trace exporter: %w", err)
	}

	tp.RegisterSpanProcessor(exporter)

	return nil
}
