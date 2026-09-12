package app

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	stdlog "log"
	"os"
	"sync"
	"time"

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

func NewRuntimeLogContainer(
	infra *Infra,
	cfg *config.Config,
	logOutput io.Writer,
	access applog.AccessValidator,
) (*RuntimeLogContainer, func()) {
	operationsDB, operationsCleanup := openRuntimeLogDB(cfg, 4)
	if operationsDB == nil {
		_, _ = fmt.Fprintln(os.Stderr, "运行日志读取连接池初始化失败；降级到业务连接池")
		operationsDB = infra.DB
		operationsCleanup = func() {}
	}
	store := infralog.NewStore(operationsDB)
	service := applog.NewService(store)
	maintenance := applog.NewMaintenanceService(store, 5*time.Minute)

	var writeDB *sql.DB
	var sink domainlog.Sink
	if cfg.RuntimeLogEnabled {
		writeDB, _ = openRuntimeLogDB(cfg, 1)
		if writeDB == nil {
			_, _ = fmt.Fprintln(os.Stderr, "运行日志写入连接池初始化失败；仅保留 stderr")
		} else {
			sink = infralog.NewStore(writeDB)
		}
	}
	capture := infralog.NewCapture(sink, os.Stderr, cfg.RuntimeLogEnabled)
	container := &RuntimeLogContainer{Handler: loghttp.NewHandler(
		service, capture, maintenance, access, func() string { return zerolog.GlobalLevel().String() },
	)}
	infra.Gorm.Logger = infralog.NewGormLogger()

	previousLogger := log.Logger
	standardOutput := stdlog.Writer()
	if sink != nil {
		log.Logger = previousLogger.Output(zerolog.MultiLevelWriter(capture, logOutput))
		stdlog.SetOutput(io.MultiWriter(capture.StandardWriter(), standardOutput))
	}

	ctx, cancel := context.WithCancel(context.Background())
	var workers sync.WaitGroup
	workers.Add(1)
	go func() {
		defer workers.Done()
		maintenance.Run(ctx)
	}()
	if sink != nil {
		workers.Add(1)
		go func() {
			defer workers.Done()
			capture.Run(ctx)
		}()
	}

	return container, func() {
		if sink != nil {
			log.Logger = previousLogger
			stdlog.SetOutput(standardOutput)
		}
		cancel()
		workers.Wait()
		if writeDB != nil {
			_ = writeDB.Close()
		}
		operationsCleanup()
	}
}

func openRuntimeLogDB(cfg *config.Config, maxConnections int) (*sql.DB, func()) {
	db, err := sql.Open("pgx", cfg.Database.DSN())
	if err != nil {
		return nil, func() {}
	}
	db.SetMaxOpenConns(maxConnections)
	db.SetMaxIdleConns(maxConnections)
	db.SetConnMaxLifetime(cfg.Database.ConnMaxLifetime)
	return db, func() { _ = db.Close() }
}
