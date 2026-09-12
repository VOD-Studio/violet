package runtimelog

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	applog "blog-api/internal/application/runtimelog"
	domainlog "blog-api/internal/domain/runtimelog"
)

const (
	queueCapacity = 2048
	batchSize     = 64
	maxEventBytes = 32 << 10
)

type Capture struct {
	queue           chan domainlog.Entry
	enabled         bool
	enqueueMu       sync.RWMutex
	store           domainlog.Sink
	fallback        io.Writer
	accepted        atomic.Uint64
	persisted       atomic.Uint64
	overflow        atomic.Uint64
	failed          atomic.Uint64
	malformed       atomic.Uint64
	shutdownDropped atomic.Uint64
	oversized       atomic.Uint64
	closed          atomic.Bool
	lastFailure     atomic.Int64
	lastWarning     atomic.Int64
}

func NewCapture(store domainlog.Sink, fallback io.Writer, enabled bool) *Capture {
	capture := &Capture{store: store, fallback: fallback, enabled: enabled}
	if enabled && store != nil {
		capture.queue = make(chan domainlog.Entry, queueCapacity)
	} else {
		capture.closed.Store(true)
	}
	return capture
}

func (c *Capture) Stats() applog.CollectionStatus {
	stats := applog.CollectionStatus{
		Enabled: c.enabled, InitializationFailed: c.enabled && c.store == nil,
		Accepted: c.accepted.Load(), Persisted: c.persisted.Load(),
		QueueOverflow: c.overflow.Load(), PersistenceFailed: c.failed.Load(),
		Malformed: c.malformed.Load(), Oversized: c.oversized.Load(), ShutdownDropped: c.shutdownDropped.Load(),
		Queued: len(c.queue), Capacity: cap(c.queue),
	}
	if timestamp := c.lastFailure.Load(); timestamp > 0 {
		instant := time.Unix(0, timestamp).UTC()
		stats.LastFailure = &instant
	}
	return stats
}

// Write 只接收结构化白名单字段；不会向日志调用方传播持久化故障。
func (c *Capture) Write(p []byte) (int, error) {
	if c.closed.Load() {
		c.shutdownDropped.Add(1)
		return len(p), nil
	}
	if len(p) > maxEventBytes {
		c.oversized.Add(1)
		return len(p), nil
	}
	if len(c.queue) == cap(c.queue) {
		c.overflow.Add(1)
		return len(p), nil
	}
	var raw struct {
		Time      json.RawMessage `json:"time"`
		Level     string          `json:"level"`
		Source    string          `json:"source"`
		Component string          `json:"component"`
		Service   string          `json:"service"`
		Message   string          `json:"message"`
		Error     string          `json:"error"`
		RequestID string          `json:"request_id"`
		TraceID   string          `json:"trace_id"`
		Method    string          `json:"method"`
		Path      string          `json:"path"`
		Status    int             `json:"status"`
	}
	if err := json.Unmarshal(p, &raw); err != nil {
		c.malformed.Add(1)
		return len(p), nil
	}
	now := time.Now().UTC()
	occurred := now
	if len(raw.Time) > 0 {
		if raw.Time[0] == '"' {
			var value string
			if json.Unmarshal(raw.Time, &value) == nil {
				if parsed, err := time.Parse(time.RFC3339Nano, value); err == nil {
					occurred = parsed
				}
			}
		} else if seconds, err := strconv.ParseFloat(string(raw.Time), 64); err == nil {
			occurred = time.Unix(0, int64(seconds*float64(time.Second))).UTC()
		}
	}
	source := raw.Source
	if source == "" {
		source = raw.Component
	}
	if source == "" {
		source = raw.Service
	}
	if source == "" {
		source = "application"
	}
	message := raw.Message
	if raw.Method != "" && raw.Path != "" {
		message += " · " + raw.Method + " " + raw.Path
		if raw.Status > 0 {
			message += fmt.Sprintf(" · %d", raw.Status)
		}
	}
	if raw.Error != "" {
		message += " · " + raw.Error
	}
	level := strings.ToLower(raw.Level)
	switch level {
	case "trace", "debug", "info", "warn", "error", "fatal", "panic":
	default:
		level = "info"
	}
	c.record(occurred, now, level, source, message, raw.RequestID, raw.TraceID)
	return len(p), nil
}

func (c *Capture) record(occurred, received time.Time, level, source, message, requestID, traceID string) {
	c.enqueue(domainlog.Entry{OccurredAt: occurred, ReceivedAt: received, Level: level, Source: redact(source, 128), Message: redact(message, 8192), RequestID: redact(requestID, 128), TraceID: redact(traceID, 128)})
}

type standardWriter struct{ capture *Capture }

// StandardWriter 供标准库 log 使用，和 zerolog 共用接收顺序及脱敏入口。
func (c *Capture) StandardWriter() io.Writer { return standardWriter{capture: c} }

func (w standardWriter) Write(p []byte) (int, error) {
	if w.capture.closed.Load() {
		w.capture.shutdownDropped.Add(1)
		return len(p), nil
	}
	if len(p) > maxEventBytes {
		w.capture.oversized.Add(1)
		return len(p), nil
	}
	if len(w.capture.queue) == cap(w.capture.queue) {
		w.capture.overflow.Add(1)
		return len(p), nil
	}
	now := time.Now().UTC()
	w.capture.enqueue(domainlog.Entry{OccurredAt: now, ReceivedAt: now, Level: "info", Source: "stdlib", Message: redact(strings.TrimSpace(string(p)), 8192)})
	return len(p), nil
}

func (c *Capture) enqueue(entry domainlog.Entry) {
	c.enqueueMu.RLock()
	defer c.enqueueMu.RUnlock()
	if c.closed.Load() {
		c.shutdownDropped.Add(1)
		return
	}
	select {
	case c.queue <- entry:
		c.accepted.Add(1)
	default:
		c.overflow.Add(1)
	}
}

// Run 仅一个消费协程；关停时有独立预算排空，不在业务请求上等待数据库。
func (c *Capture) Run(ctx context.Context) {
	if c.queue == nil {
		return
	}
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()
	batch := make([]domainlog.Entry, 0, batchSize)
	flush := func(parent context.Context) {
		if len(batch) == 0 {
			return
		}
		writeCtx, cancel := context.WithTimeout(parent, 2*time.Second)
		err := c.store.Append(writeCtx, batch)
		cancel()
		if err != nil && parent.Err() != nil {
			c.shutdownDropped.Add(uint64(len(batch)))
		} else if err != nil {
			c.failed.Add(uint64(len(batch)))
			now := time.Now().UnixNano()
			c.lastFailure.Store(now)
			previous := c.lastWarning.Load()
			if now-previous >= int64(time.Minute) && c.lastWarning.CompareAndSwap(previous, now) && c.fallback != nil {
				_, _ = io.WriteString(c.fallback, "runtime log persistence failed; records dropped\n")
			}
		} else {
			c.persisted.Add(uint64(len(batch)))
		}
		clear(batch)
		batch = batch[:0]
	}
	for {
		select {
		case entry := <-c.queue:
			batch = append(batch, entry)
			if len(batch) == batchSize {
				flush(ctx)
			}
		case <-ticker.C:
			flush(ctx)
		case <-ctx.Done():
			c.enqueueMu.Lock()
			c.closed.Store(true)
			c.enqueueMu.Unlock()
			shutdown, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			for {
				select {
				case entry := <-c.queue:
					batch = append(batch, entry)
					if len(batch) == batchSize {
						flush(shutdown)
					}
				case <-shutdown.Done():
					c.shutdownDropped.Add(uint64(len(batch) + len(c.queue)))
					clear(batch)
					for len(c.queue) > 0 {
						<-c.queue
					}
					return
				default:
					flush(shutdown)
					return
				}
			}
		}
	}
}
