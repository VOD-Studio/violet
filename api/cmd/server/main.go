package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"blog-api/config"
	"blog-api/internal/handler"
	"blog-api/internal/job"
	"blog-api/internal/migrate"
	"blog-api/internal/middleware"
	"blog-api/internal/model"
	"blog-api/internal/repository/generated"
	"blog-api/internal/service"
)

func main() {
	_ = godotenv.Load()
	ctx := context.Background()
	cfg := config.Load()

	// --- 基础设施初始化 ---

	db, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}
	defer db.Close()
	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("数据库 ping 失败: %v", err)
	}
	log.Println("数据库连接成功")

	migrateURL := fmt.Sprintf("pgx5://%s", cfg.DatabaseURL[len("postgres://"):])
	if err := migrate.RunMigrations("migrations", migrateURL, db); err != nil {
		log.Fatalf("数据库迁移失败: %v", err)
	}

	redisOpt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("解析 Redis 地址失败: %v", err)
	}
	redisClient := redis.NewClient(redisOpt)
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatalf("Redis 连接失败: %v", err)
	}
	log.Println("Redis 连接成功")

	gormDB, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{})
	if err != nil {
		log.Fatalf("GORM 连接失败: %v", err)
	}
	if err := gormDB.AutoMigrate(&model.File{}, &model.UploadSession{}); err != nil {
		log.Fatalf("GORM 自动迁移失败: %v", err)
	}

	queries := generated.New(db)

	// --- 服务层初始化 ---

	emailService := service.NewEmailService(cfg.ResendAPIKey, cfg.EmailFrom)
	authService := service.NewAuthService(queries, redisClient, emailService, cfg)
	postService := service.NewPostService(queries)
	tagService := service.NewTagService(queries)
	commentService := service.NewCommentService(queries)
	statsService := service.NewStatsService(queries)
	settingsService := service.NewSettingsService(queries)
	userService := service.NewUserService(queries)
	fileService := service.NewFileService(gormDB, "uploads", cfg.UploadPathPrefix)
	uploadService := service.NewUploadService(gormDB, fileService, "uploads/tmp", "uploads", cfg.UploadPathPrefix, 1024*1024*1024)
	musicService := service.NewMusicService()
	musicPlaylistAdminService := service.NewMusicPlaylistAdminService(queries, musicService)
	musicSettingsService := service.NewMusicSettingsService(queries)
	projectService := service.NewProjectService(queries)
	emojiService := service.NewEmojiService(queries, "uploads/emojis", cfg.BilibiliCookie)

	count, err := queries.CountEmojiGroups(ctx)
	if err != nil {
		log.Printf("检查表情分组数量失败: %v", err)
	} else if count == 0 {
		log.Println("表情分组为空，开始初始化 B站表情种子数据...")
		if err := emojiService.SeedBilibiliEmojis(ctx); err != nil {
			log.Printf("表情种子数据初始化失败: %v（不影响服务启动）", err)
		}
	} else {
		log.Printf("表情分组已有 %d 条数据，跳过种子初始化", count)
	}

	cleanupJob := job.NewCleanupJob(gormDB, "uploads/tmp")
	go cleanupJob.Start(ctx)

	// --- 处理器初始化 ---

	authHandler := handler.NewAuthHandler(authService, cfg.UploadPathPrefix)
	postHandler := handler.NewPostHandler(postService, tagService)
	tagHandler := handler.NewTagHandler(tagService)
	commentHandler := handler.NewCommentHandler(commentService)
	adminHandler := handler.NewAdminHandler(statsService)
	settingsHandler := handler.NewSettingsHandler(settingsService)
	userMgmtHandler := handler.NewUserManagementHandler(userService)
	mediaHandler := handler.NewMediaHandler(fileService, "uploads")
	uploadHandler := handler.NewUploadHandler(uploadService)
	musicHandler := handler.NewMusicHandler(musicService)
	musicAdminHandler := handler.NewMusicAdminHandler(musicPlaylistAdminService, musicSettingsService)
	projectHandler := handler.NewProjectHandler(projectService)
	emojiHandler := handler.NewEmojiHandler(emojiService)

	// --- 路由注册 ---

	r := chi.NewRouter()
	r.Use(middleware.Logger)    // 请求日志记录
	r.Use(middleware.CORS)      // 跨域资源共享
	r.Use(middleware.Recoverer) // panic 恢复

	// 健康检查（无版本前缀）
	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ok","message":"博客 API 服务运行中"}`)
	})

	// =====================================================
	// API v1
	// =====================================================
	r.Route("/api/v1", func(v1 chi.Router) {

		// 公开站点设置
		v1.Get("/settings", settingsHandler.GetPublicSettings) // 获取公开站点配置

		// 认证
		v1.Route("/auth", func(r chi.Router) {
			r.Post("/register", authHandler.Register)           // 用户注册
			r.Post("/verify-email", authHandler.VerifyEmail)    // 邮箱验证
			r.Post("/login", authHandler.Login)                 // 用户登录
			r.Post("/refresh", authHandler.RefreshToken)        // 刷新令牌
			r.Post("/forgot-password", authHandler.ForgotPassword) // 发送重置密码邮件
			r.Post("/reset-password", authHandler.ResetPassword)   // 重置密码

			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth(authService))
				r.Post("/logout", authHandler.Logout)           // 用户登出
				r.Get("/me", authHandler.Me)                    // 获取当前用户信息
				r.Patch("/profile", authHandler.UpdateProfile)  // 更新个人资料
				r.Patch("/password", authHandler.UpdatePassword) // 修改密码
			})
		})

		// 文章
		v1.Route("/posts", func(r chi.Router) {
			r.Get("/", postHandler.List)                  // 文章列表（分页）
			r.Get("/id/{id}", postHandler.GetByID)        // 按 ID 获取文章（编辑用）
			r.Get("/{slug}", postHandler.GetBySlug)       // 按 slug 获取文章（展示用）
			r.Post("/{id}/view", postHandler.IncrementView) // 增加浏览次数

			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth(authService))
				r.Post("/", postHandler.Create)              // 创建文章
				r.Put("/{id}", postHandler.Update)           // 更新文章
				r.Delete("/{id}", postHandler.Delete)        // 删除文章
				r.Patch("/{id}/status", postHandler.UpdateStatus) // 更新文章状态（发布/草稿）
			})
		})

		// 标签
		v1.Route("/tags", func(r chi.Router) {
			r.Get("/", tagHandler.List) // 标签列表

			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth(authService))
				r.Post("/", tagHandler.Create)      // 创建标签
				r.Delete("/{id}", tagHandler.Delete) // 删除标签
			})
		})

		// 评论
		v1.Route("/posts/{id}/comments", func(r chi.Router) {
			r.Get("/", commentHandler.ListApprovedComments)  // 获取文章已审核评论
			r.With(middleware.CommentRateLimit(redisClient)).Post("/", commentHandler.CreateComment) // 提交评论（限流）
		})

		v1.Route("/comments/{id}", func(r chi.Router) {
			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth(authService))
				r.Use(middleware.AdminRequired)
				r.Patch("/status", commentHandler.UpdateCommentStatus) // 审核评论（通过/拒绝）
				r.Delete("/", commentHandler.DeleteComment)            // 删除评论
			})
		})

		// 媒体
		v1.Route("/media", func(r chi.Router) {
			r.Get("/{id}", mediaHandler.GetMedia) // 获取媒体详情（公开）

			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth(authService))
				r.Get("/", mediaHandler.ListMedia)                     // 媒体列表（分页、类型筛选）
				r.Delete("/{id}", mediaHandler.DeleteMedia)            // 删除媒体
				r.Post("/batch-delete", mediaHandler.BatchDeleteMedia) // 批量删除媒体
				r.Post("/{id}/thumbnail", mediaHandler.UploadThumbnail) // 上传视频封面缩略图
			})
		})

		// 分片上传
		v1.Route("/upload", func(r chi.Router) {
			r.Use(middleware.Auth(authService))
			r.Post("/init", uploadHandler.InitSession)                  // 初始化上传会话（含秒传检查、断点续传恢复）
			r.Put("/{uploadId}/chunk/{index}", uploadHandler.SaveChunk) // 上传单个分片
			r.Post("/{uploadId}/complete", uploadHandler.CompleteUpload) // 合并所有分片为完整文件
			r.Delete("/{uploadId}", uploadHandler.CancelUpload)         // 取消上传，清理临时分片
			r.Get("/{uploadId}/status", uploadHandler.GetUploadStatus)  // 查询上传状态（断点续传）
		})

		// 音乐
		v1.Route("/music", func(r chi.Router) {
			r.Get("/embed", musicHandler.GetEmbedInfo)                       // 解析音乐链接返回嵌入信息
			r.Get("/playlist", musicHandler.GetPlaylist)                     // 解析歌单链接返回歌单信息
			r.Get("/song", musicHandler.GetSongDetail)                       // 获取歌曲详情
			r.Get("/playlist/config/active", musicAdminHandler.GetActivePlaylist)  // 获取启用的歌单配置
			r.Get("/playlists/active", musicAdminHandler.GetAllActivePlaylists)    // 获取所有启用歌单
			r.Get("/settings", musicAdminHandler.GetMusicSettings)                  // 获取播放器设置
		})

		// 项目
		v1.Route("/projects", func(r chi.Router) {
			r.Get("/", projectHandler.List)      // 项目列表
			r.Get("/{id}", projectHandler.GetByID) // 项目详情
		})

		// 表情（公开）
		v1.Route("/emojis", func(r chi.Router) {
			r.Get("/", emojiHandler.GetAllEmojis)                  // 获取所有启用表情分组和表情
			r.Get("/groups/{name}", emojiHandler.GetEmojiGroupByName) // 按名称获取指定表情分组
		})

		// =====================================================
		// 管理员路由（认证 + 管理员权限）
		// =====================================================
		v1.Route("/admin", func(r chi.Router) {
			r.Use(middleware.Auth(authService))
			r.Use(middleware.AdminRequired)

			r.Get("/stats", adminHandler.GetDashboardStats)  // 仪表盘总览统计
			r.Get("/stats/views", adminHandler.GetViewTrends) // 浏览量趋势

			r.Get("/settings", settingsHandler.GetSettings)   // 获取站点设置
			r.Put("/settings", settingsHandler.UpdateSettings) // 更新站点设置

			r.Get("/users", userMgmtHandler.ListUsers)                      // 用户列表
			r.Patch("/users/{id}/role", userMgmtHandler.UpdateUserRole)     // 修改用户角色
			r.Patch("/users/{id}/status", userMgmtHandler.UpdateUserStatus) // 启用/禁用用户

			r.Get("/comments/pending", commentHandler.ListPendingComments)      // 待审核评论列表
			r.Get("/comments/pending/count", commentHandler.CountPendingComments) // 待审核评论数量

			r.Route("/playlists", func(r chi.Router) {
				r.Get("/", musicAdminHandler.ListPlaylists)                       // 歌单列表
				r.Post("/", musicAdminHandler.CreatePlaylist)                     // 导入歌单
				r.Patch("/{id}", musicAdminHandler.UpdatePlaylist)               // 更新歌单（启用/禁用）
				r.Delete("/{id}", musicAdminHandler.DeletePlaylist)              // 删除歌单
				r.Post("/{id}/activate", musicAdminHandler.SetActivePlaylist)    // 设置为启用歌单
				r.Post("/{id}/refresh", musicAdminHandler.RefreshPlaylistSongs)  // 刷新歌单歌曲
			})

			r.Patch("/music/settings", musicAdminHandler.UpdatePlayerVersion) // 更新播放器设置

			r.Route("/emoji-groups", func(r chi.Router) {
				r.Get("/", emojiHandler.ListAllGroups)                  // 获取所有表情分组（含未启用）
				r.Post("/", emojiHandler.CreateGroup)                   // 创建表情分组
				r.Patch("/batch-status", emojiHandler.BatchUpdateStatus) // 批量更新分组启用状态
				r.Patch("/{id}", emojiHandler.UpdateGroup)              // 更新表情分组
				r.Delete("/{id}", emojiHandler.DeleteGroup)             // 删除表情分组
				r.Get("/{id}/emojis", emojiHandler.ListGroupEmojis)    // 获取分组内表情列表
				r.Post("/{id}/emojis", emojiHandler.CreateEmoji)        // 在分组内创建表情
			})

			r.Route("/emojis", func(r chi.Router) {
				r.Post("/upload", emojiHandler.UploadEmoji)   // 上传表情图片
				r.Patch("/{id}", emojiHandler.UpdateEmoji)    // 更新表情
				r.Delete("/{id}", emojiHandler.DeleteEmoji)   // 删除表情
			})

			r.Route("/projects", func(r chi.Router) {
				r.Post("/", projectHandler.Create)          // 创建项目
				r.Put("/{id}", projectHandler.Update)       // 更新项目
				r.Delete("/{id}", projectHandler.Delete)    // 删除项目
			})
		})
	})

	// 静态文件服务（无版本前缀）
	fileServer := http.FileServer(http.Dir("./uploads"))
	r.Get("/uploads/*", func(w http.ResponseWriter, r *http.Request) {
		http.StripPrefix("/uploads/", fileServer).ServeHTTP(w, r)
	})

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("博客 API 服务启动，监听地址 %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("服务启动失败: %v", err)
	}
}
