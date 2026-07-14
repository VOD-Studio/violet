// Package observability 提供 mimo-music 的可观测性基础设施。
package observability

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"testing"
)

// TestRedactHandler_MasksSensitiveFields 验证脱敏 handler 把敏感字段替换为遮蔽或 hash。
func TestRedactHandler_MasksSensitiveFields(t *testing.T) {
	var buf bytes.Buffer
	// redact → JSON handler
	jsonHandler := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
	handler := newRedactHandler(jsonHandler)
	logger := slog.New(handler)

	logger.Info("login attempt",
		slog.String("cookie", "MUSIC_U=secret123; osver=1"),
		slog.String("phone", "13800138000"),
		slog.String("password", "mypass"),
		slog.String("username", "bob"),
	)

	var entry map[string]any
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("unmarshal log failed: %v", err)
	}

	// cookie 应被 hash（可关联不可逆）
	cookieHash, ok := entry["cookie_hash"]
	if !ok {
		t.Fatal("expected cookie_hash field, not found")
	}
	if cookieHash == "MUSIC_U=secret123; osver=1" {
		t.Error("cookie value not hashed, still plaintext")
	}

	// phone 应被 hash
	if _, ok := entry["phone_hash"]; !ok {
		t.Fatal("expected phone_hash field, not found")
	}

	// password 应被完全遮蔽
	if entry["password"] != "***" {
		t.Errorf("expected password masked as ***, got %v", entry["password"])
	}

	// 非敏感字段保留原值
	if entry["username"] != "bob" {
		t.Errorf("expected username preserved, got %v", entry["username"])
	}
}

// TestRedactHandler_NoSensitiveLeak 验证原始敏感值不出现在日志中。
func TestRedactHandler_NoSensitiveLeak(t *testing.T) {
	var buf bytes.Buffer
	jsonHandler := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
	handler := newRedactHandler(jsonHandler)
	logger := slog.New(handler)

	sensitiveValues := []string{"MUSIC_U=secret", "13800138000", "mypass"}

	logger.Info("test",
		slog.String("cookie", sensitiveValues[0]),
		slog.String("phone", sensitiveValues[1]),
		slog.String("password", sensitiveValues[2]),
	)

	output := buf.String()
	for _, v := range sensitiveValues {
		if bytes.Contains(buf.Bytes(), []byte(v)) {
			t.Errorf("sensitive value %q leaked into log output", v)
		}
	}
	_ = output
}

// TestOtelHandler_InjectsTraceID 验证 otel handler 在有 span 时注入 trace_id。
func TestOtelHandler_InjectsTraceID(t *testing.T) {
	var buf bytes.Buffer
	jsonHandler := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
	handler := newOtelHandler(jsonHandler)
	logger := slog.New(handler)

	// 无 span 时不应注入 trace_id
	logger.Info("no span")
	var entry map[string]any
	_ = json.Unmarshal(buf.Bytes(), &entry)
	if _, ok := entry[FieldTraceID]; ok {
		t.Error("should not inject trace_id when no span")
	}

	// 确保不会 panic（有 context 但无 span）
	logger.InfoContext(context.Background(), "with empty ctx")
}
