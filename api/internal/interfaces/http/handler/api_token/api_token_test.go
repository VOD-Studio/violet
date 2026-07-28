package apitoken

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseExpiry_EmptyDefaultsTo90Days(t *testing.T) {
	now := time.Date(2026, 7, 28, 12, 0, 0, 0, time.Local)
	got, err := parseExpiry("", now)
	require.NoError(t, err)
	assert.Equal(t, now.Add(90*24*time.Hour), got, "空串应默认 90 天后过期（安全默认值）")
}

func TestParseExpiry_NeverMeansNoExpiry(t *testing.T) {
	now := time.Date(2026, 7, 28, 12, 0, 0, 0, time.Local)
	got, err := parseExpiry("never", now)
	require.NoError(t, err)
	assert.True(t, got.IsZero(), "never 应解析为零值（永不过期）")
}

func TestParseExpiry_FutureDateEndsOfDay(t *testing.T) {
	now := time.Date(2026, 7, 28, 12, 0, 0, 0, time.UTC)
	got, err := parseExpiry("2026-08-01", now)
	require.NoError(t, err)
	want := time.Date(2026, 8, 1, 23, 59, 59, 0, time.UTC)
	assert.Equal(t, want, got, "未来日期应取当天 23:59:59")
}

func TestParseExpiry_TodayIsAllowed(t *testing.T) {
	now := time.Date(2026, 7, 28, 12, 0, 0, 0, time.UTC)
	got, err := parseExpiry("2026-07-28", now)
	require.NoError(t, err, "选当天不应报创建即过期（给足整天）")
	assert.True(t, got.After(now))
}

func TestParseExpiry_RejectsPastDate(t *testing.T) {
	now := time.Date(2026, 7, 28, 12, 0, 0, 0, time.UTC)
	_, err := parseExpiry("2020-01-01", now)
	assert.Error(t, err, "过去日期应拒绝（否则创建即过期）")
}

func TestParseExpiry_RejectsInvalidFormat(t *testing.T) {
	now := time.Date(2026, 7, 28, 12, 0, 0, 0, time.UTC)
	for _, s := range []string{"2026/08/01", "90d", "tomorrow"} {
		_, err := parseExpiry(s, now)
		assert.Error(t, err, "%q 非法格式应拒绝", s)
	}
}
