package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/redis/go-redis/v9"

	"blog-api/config"
	"blog-api/internal/handler"
	"blog-api/internal/middleware"
	"blog-api/internal/repository/generated"
	"blog-api/internal/service"
)

func main() {
	ctx := context.Background()

	// 加载应用配置
	cfg := config.Load()

	// 使用 pgx 驱动初始化数据库连接
	// pgx/v5/stdlib 提供 database/sql 兼容的驱动接口
	db, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}
	defer db.Close()

	// 验证数据库连接
	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("数据库 ping 失败: %v", err)
	}
	log.Println("数据库连接成功")

	// 初始化 Redis 客户端
	redisOpt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("解析 Redis 地址失败: %v", err)
	}
	redisClient := redis.NewClient(redisOpt)

	// 验证 Redis 连接
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatalf("Redis 连接失败: %v", err)
	}
	log.Println("Redis 连接成功")

	// 创建 sqlc 查询实例
	queries := generated.New(db)

	// 初始化服务层
	emailService := service.NewEmailService(cfg.ResendAPIKey, cfg.EmailFrom)
	authService := service.NewAuthService(queries, redisClient, emailService, cfg)

	// 初始化处理器
	authHandler := handler.NewAuthHandler(authService)

	// 创建 chi 路由实例
	r := chi.NewRouter()

	// 注册全局中间件
	r.Use(middleware.Logger)    // 请求日志记录
	r.Use(middleware.CORS)      // 跨域资源共享
	r.Use(middleware.Recoverer) // panic 恢复

	// 健康检查端点
	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ok","message":"博客 API 服务运行中"}`)
	})

	// 认证相关路由
	r.Route("/api/auth", func(r chi.Router) {
		// 公开接口，无需认证
		r.Post("/register", authHandler.Register)              // 用户注册
		r.Post("/verify-email", authHandler.VerifyEmail)       // 邮箱验证
		r.Post("/login", authHandler.Login)                    // 用户登录
		r.Post("/refresh", authHandler.RefreshToken)           // 刷新令牌
		r.Post("/forgot-password", authHandler.ForgotPassword) // 忘记密码
		r.Post("/reset-password", authHandler.ResetPassword)   // 重置密码

		// 需要认证的接口
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(authService))
			r.Post("/logout", authHandler.Logout) // 用户登出
			r.Get("/me", authHandler.Me)          // 获取当前用户信息
		})
	})

	// 启动 HTTP 服务
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("博客 API 服务启动，监听地址 %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("服务启动失败: %v", err)
	}
}
