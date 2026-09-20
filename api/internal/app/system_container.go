package app

import (
	"context"
	"database/sql"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"blog-api/config"
	appsystem "blog-api/internal/application/system"
	domainsettings "blog-api/internal/domain/settings"
	infrasystem "blog-api/internal/infrastructure/system"
	systemhttp "blog-api/internal/interfaces/http/handler/system"
)

// SystemContainer 聚合系统面板服务与 HTTP 入口。
type SystemContainer struct {
	SystemHandler *systemhttp.Handler
	Service       *appsystem.Service
}

// NewSystemContainer 装配系统面板并启动监控采样与自动备份调度。
func NewSystemContainer(
	sqlDB *sql.DB,
	db *gorm.DB,
	rdb *redis.Client,
	settings domainsettings.SettingsStore,
	cfg *config.Config,
	ctx context.Context,
) (*SystemContainer, error) {
	collector := infrasystem.NewCollector()
	database := infrasystem.NewDatabase(sqlDB)
	backups, err := infrasystem.NewBackupManager(
		cfg.Database,
		cfg.BackupDir,
		cfg.UploadDir,
		[]byte(cfg.ResourceSigningKey),
	)
	if err != nil {
		return nil, err
	}
	svc := appsystem.NewService(db, rdb, collector, database, backups, settings)
	sampler := appsystem.NewSampler(ctx, collector, svc)
	go sampler.Run()
	go svc.RunBackupScheduler(ctx)
	return &SystemContainer{
		SystemHandler: systemhttp.NewHandler(svc),
		Service:       svc,
	}, nil
}
