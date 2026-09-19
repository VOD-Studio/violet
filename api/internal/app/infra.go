package app

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/redis/go-redis/v9"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"blog-api/config"
	newmodel "blog-api/internal/infrastructure/persistence/gorm/model"
	"blog-api/internal/middleware"
	"blog-api/internal/migrate"

	"github.com/rs/zerolog/log"
)

// Infra 聚合基础设施连接：底层 *sql.DB（pgx）、GORM 句柄、Redis 客户端。
type Infra struct {
	DB    *sql.DB
	Gorm  *gorm.DB
	Redis *redis.Client
}

// InitInfra 初始化全部基础设施：数据库连接 + 迁移、Redis 连接、受信代理、GORM + AutoMigrate。
// 返回 cleanup 关闭 DB 连接；Redis 由 GC 回收，无需显式关闭。
// 任一步骤失败则 log.Fatal（与原 main 行为一致）。
func InitInfra(ctx context.Context, cfg *config.Config) (*Infra, func()) {
	db, err := sql.Open("pgx", cfg.Database.DSN())
	if err != nil {
		log.Fatal().Err(err).Msg("数据库连接失败")
	}
	db.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	db.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.Database.ConnMaxLifetime)

	migrateURL := fmt.Sprintf("pgx5://%s", cfg.Database.DSN()[len("postgres://"):])
	if err := migrate.RunMigrations("migrations", migrateURL, db); err != nil {
		log.Fatal().Err(err).Msg("数据库迁移失败")
	}

	redisOpt, err := redis.ParseURL(cfg.Redis.DSN())
	if err != nil {
		log.Fatal().Err(err).Msg("解析 Redis 地址失败")
	}
	redisClient := redis.NewClient(redisOpt)
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatal().Err(err).Msg("Redis 连接失败")
	}
	log.Info().Msg("Redis 连接成功")

	// 配置受信代理（限流/IP 提取依赖；为空时一律使用 RemoteAddr）
	middleware.SetTrustedProxies(cfg.TrustedProxies)

	gormDB, err := gorm.Open(postgres.New(postgres.Config{Conn: db}), &gorm.Config{})
	if err != nil {
		log.Fatal().Err(err).Msg("GORM 连接失败")
	}

	// DDD 新 model 的 AutoMigrate（全 GORM AutoMigrate 策略）
	// 记录警告但不致命退出，保证服务能启动。
	if err := gormDB.AutoMigrate(
		&newmodel.User{}, &newmodel.Role{}, &newmodel.Permission{}, &newmodel.RolePermission{},
		&newmodel.Post{}, &newmodel.PostVersion{}, &newmodel.PostView{}, &newmodel.Tag{},
		&newmodel.Comment{}, &newmodel.CommentReaction{},
		&newmodel.Announcement{}, &newmodel.Project{},
		&newmodel.EmojiGroup{}, &newmodel.Emoji{}, &newmodel.Playlist{},
		&newmodel.MusicSetting{},
		&newmodel.File{}, &newmodel.UploadSession{},
		&newmodel.APIToken{},
		&newmodel.Subscription{},
		&newmodel.SubscriptionEntry{},
	); err != nil {
		log.Warn().Err(err).Msg("AutoMigrate error")
	}

	infra := &Infra{DB: db, Gorm: gormDB, Redis: redisClient}
	cleanup := func() { db.Close() }
	return infra, cleanup
}
