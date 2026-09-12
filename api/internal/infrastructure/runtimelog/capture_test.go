package runtimelog

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"sync"
	"testing"
	"time"

	domainlog "blog-api/internal/domain/runtimelog"

	"github.com/stretchr/testify/require"
)

type appendSink func(context.Context, []domainlog.Entry) error

func (f appendSink) Append(ctx context.Context, entries []domainlog.Entry) error {
	return f(ctx, entries)
}

func TestCaptureDropsWithoutWaitingForBlockedPersistence(t *testing.T) {
	entered := make(chan struct{})
	release := make(chan struct{})
	var once sync.Once
	sink := appendSink(func(ctx context.Context, _ []domainlog.Entry) error {
		once.Do(func() { close(entered) })
		select {
		case <-release:
			return errors.New("storage unavailable")
		case <-ctx.Done():
			return ctx.Err()
		}
	})
	capture := NewCapture(sink, io.Discard, true)
	ctx, cancel := context.WithCancel(context.Background())
	stopped := make(chan struct{})
	go func() { defer close(stopped); capture.Run(ctx) }()
	t.Cleanup(func() { cancel(); <-stopped })
	event := []byte(`{"level":"info","message":"queue-probe"}`)
	for range batchSize {
		_, err := capture.Write(event)
		require.NoError(t, err)
	}
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("first batch did not reach persistence")
	}
	written := make(chan struct{})
	go func() {
		defer close(written)
		for range queueCapacity + 17 {
			_, _ = capture.Write(event)
		}
	}()
	select {
	case <-written:
	case <-time.After(time.Second):
		t.Fatal("log writes waited for blocked persistence")
	}
	status := capture.Stats()
	require.Equal(t, queueCapacity, status.Queued)
	require.Equal(t, uint64(17), status.QueueOverflow)
	close(release)
	require.Eventually(t, func() bool {
		return capture.Stats().PersistenceFailed == uint64(batchSize+queueCapacity)
	}, time.Second, time.Millisecond)
	status = capture.Stats()
	require.Zero(t, status.Persisted)
	require.NotNil(t, status.LastFailure)
}

func TestCapturePersistsOnlyRedactedWhitelistedFields(t *testing.T) {
	var entries []domainlog.Entry
	sink := appendSink(func(_ context.Context, batch []domainlog.Entry) error {
		entries = append(entries, batch...)
		return nil
	})
	capture := NewCapture(sink, io.Discard, true)
	ctx, cancel := context.WithCancel(context.Background())
	stopped := make(chan struct{})
	go func() { defer close(stopped); capture.Run(ctx) }()
	_, err := capture.Write([]byte(`{"time":"2026-09-12T08:00:00Z","level":"error","source":"database","message":"query-probe SELECT 'sql-secret-probe', 998877 WHERE password=password-probe","password":"raw-field-secret","request_id":"request-probe","trace_id":"trace-probe"}`))
	require.NoError(t, err)
	_, err = capture.StandardWriter().Write([]byte("Authorization: Bearer bearer-probe\nCookie: violet_session=session-probe\n验证码：654321"))
	require.NoError(t, err)
	cancel()
	<-stopped
	require.Len(t, entries, 2)
	persisted, err := json.Marshal(entries)
	require.NoError(t, err)
	for _, secret := range []string{"sql-secret-probe", "998877", "password-probe", "raw-field-secret", "bearer-probe", "session-probe", "654321"} {
		require.NotContains(t, string(persisted), secret)
	}
	require.Equal(t, "request-probe", entries[0].RequestID)
	require.Equal(t, "trace-probe", entries[0].TraceID)
	require.Contains(t, entries[0].Message, "query-probe")
	require.Equal(t, "stdlib", entries[1].Source)
	require.Empty(t, entries[1].TraceID)
	require.Equal(t, uint64(2), capture.Stats().Persisted)
}

func TestCaptureDoesNotInventHTTPStatusForAnException(t *testing.T) {
	var entries []domainlog.Entry
	capture := NewCapture(appendSink(func(_ context.Context, batch []domainlog.Entry) error {
		entries = append(entries, batch...)
		return nil
	}), io.Discard, true)
	_, err := capture.Write([]byte(`{"level":"error","method":"GET","path":"/probe","message":"exception-probe"}`))
	require.NoError(t, err)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	capture.Run(ctx)
	require.Len(t, entries, 1)
	require.Equal(t, "exception-probe · GET /probe", entries[0].Message)
}
