package app

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	stdlog "log"
	"os"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"blog-api/config"
	applog "blog-api/internal/application/runtimelog"
	domainlog "blog-api/internal/domain/runtimelog"
	infralog "blog-api/internal/infrastructure/runtimelog"
	loghttp "blog-api/internal/interfaces/http/handler/runtimelog"
)

type RuntimeLogContainer struct {
	Handler *loghttp.Handler
}

func NewRuntimeLogContainer(infra *Infra, cfg *config.Config, logOutput io.Writer) (*RuntimeLogContainer, func()) {
	var writeDB *sql.DB
	var sink domainlog.Store
	if cfg.RuntimeLogEnabled {
		var err error
		writeDB, err = sql.Open("pgx", cfg.Database.DSN())
		if err != nil {
			_, _ = fmt.Fprintln(os.Stderr, "运行日志写入连接池初始化失败；仅保留 stderr")
		} else {
			// 写日志不能占住唯一业务连接，使日志表故障阻塞普通请求。
			writeDB.SetMaxOpenConns(1)
			writeDB.SetMaxIdleConns(1)
			writeDB.SetConnMaxLifetime(cfg.Database.ConnMaxLifetime)
			sink = infralog.NewStore(writeDB)
		}
	}
	capture := infralog.NewCapture(sink, os.Stderr, cfg.RuntimeLogEnabled)
	service := applog.NewService(infralog.NewStore(infra.DB))
	container := &RuntimeLogContainer{Handler: loghttp.NewHandler(service, capture, func() string { return zerolog.GlobalLevel().String() })}
	infra.Gorm.Logger = infralog.NewGormLogger()
	if sink == nil {
		return container, func() {}
	}

	log.Logger = log.Logger.Output(zerolog.MultiLevelWriter(capture, logOutput))
	standardOutput := stdlog.Writer()
	stdlog.SetOutput(io.MultiWriter(capture.StandardWriter(), standardOutput))
	ctx, cancel := context.WithCancel(context.Background())
	stopped := make(chan struct{})
	go func() {
		defer close(stopped)
		capture.Run(ctx)
	}()
	return container, func() {
		stdlog.SetOutput(standardOutput)
		cancel()
		<-stopped
		_ = writeDB.Close()
	}
}
