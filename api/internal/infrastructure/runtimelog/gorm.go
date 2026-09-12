package runtimelog

import (
	"context"
	"fmt"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm/logger"
)

type GormLogger struct{ level logger.LogLevel }

func NewGormLogger() logger.Interface { return GormLogger{level: logger.Warn} }

func (l GormLogger) LogMode(level logger.LogLevel) logger.Interface {
	l.level = level
	return l
}

func (l GormLogger) Info(ctx context.Context, message string, data ...any) {
	l.emit(ctx, logger.Info, zerolog.InfoLevel, message, data...)
}

func (l GormLogger) Warn(ctx context.Context, message string, data ...any) {
	l.emit(ctx, logger.Warn, zerolog.WarnLevel, message, data...)
}

func (l GormLogger) Error(ctx context.Context, message string, data ...any) {
	l.emit(ctx, logger.Error, zerolog.ErrorLevel, message, data...)
}

func (l GormLogger) emit(ctx context.Context, minimum logger.LogLevel, level zerolog.Level, message string, data ...any) {
	if l.level < minimum {
		return
	}
	event := log.Ctx(ctx).WithLevel(level)
	if !event.Enabled() {
		return
	}
	if len(data) > 0 {
		message = fmt.Sprintf(message, data...)
	}
	event.Str("source", "gorm").Msg(redact(message, 8192))
}

func (l GormLogger) Trace(ctx context.Context, begin time.Time, query func() (string, int64), err error) {
	elapsed := time.Since(begin)
	var level zerolog.Level
	switch {
	case err != nil && l.level >= logger.Error:
		level = zerolog.ErrorLevel
	case elapsed > 200*time.Millisecond && l.level >= logger.Warn:
		level = zerolog.WarnLevel
	case l.level >= logger.Info:
		level = zerolog.InfoLevel
	default:
		return
	}
	event := log.Ctx(ctx).WithLevel(level)
	if !event.Enabled() {
		return
	}
	statement, rows := query()
	if err != nil {
		statement = err.Error() + " · " + statement
	}
	event.Str("source", "gorm").Dur("duration", elapsed).Int64("rows", rows).Msg(redact(statement, 8192))
}

// ParamsFilter 阻止 GORM 将绑定参数插入诊断 SQL；原生 SQL 的字面量仍由日志入口脱敏。
func (GormLogger) ParamsFilter(_ context.Context, query string, _ ...any) (string, []any) {
	return query, nil
}
