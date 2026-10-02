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

// InitInfra 装配数据库与 Redis；生产环境只校验迁移状态，开发环境自动应用迁移。
// 返回的 cleanup 关闭数据库连接；初始化失败会终止进程。
func InitInfra(ctx context.Context, cfg *config.Config) (*Infra, func()) {
	db, err := sql.Open("pgx", cfg.Database.DSN())
	if err != nil {
		log.Fatal().Err(err).Msg("数据库连接失败")
	}
	db.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	db.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.Database.ConnMaxLifetime)

	if cfg.Environment == "production" {
		if err := migrate.CheckSchema(ctx, "migrations", db); err != nil {
			log.Fatal().Err(err).Msg("数据库迁移状态校验失败")
		}
	} else {
		migrateURL := fmt.Sprintf("pgx5://%s", cfg.Database.DSN()[len("postgres://"):])
		if err := migrate.RunMigrations("migrations", migrateURL); err != nil {
			log.Fatal().Err(err).Msg("数据库迁移失败")
		}
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

	if cfg.Environment != "production" {
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
	}

	infra := &Infra{DB: db, Gorm: gormDB, Redis: redisClient}
	cleanup := func() { db.Close() }
	return infra, cleanup
}
