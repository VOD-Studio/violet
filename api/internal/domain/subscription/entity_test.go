package subscription

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/shared"
)

func mustID(t *testing.T) shared.ID {
	t.Helper()
	return shared.NewID()
}

func TestNewSubscription_ValidatesFeedURLAndInterval(t *testing.T) {
	uid := mustID(t)
	now := time.Now()

	t.Run("拒绝非法 feed URL", func(t *testing.T) {
		for _, bad := range []string{"", "not-a-url", "ftp://x", "http://"} {
			_, err := NewSubscription(uid, bad, "t", IntervalDaily, now)
			assert.Error(t, err, "%q 应被拒绝", bad)
		}
	})

	t.Run("拒绝非法 interval", func(t *testing.T) {
		_, err := NewSubscription(uid, "https://example.com/feed", "t", "every-minute", now)
		assert.Error(t, err)
	})

	t.Run("合法输入创建 active 订阅 + 推进 nextFetchAt", func(t *testing.T) {
		s, err := NewSubscription(uid, "https://example.com/feed.xml", "源", IntervalDaily, now)
		require.NoError(t, err)
		assert.Equal(t, StatusActive, s.Status())
		assert.Equal(t, SourceTypeRSS, s.SourceType()) // 本期固定 rss
		assert.False(t, s.AutoPublish())              // 默认建草稿
		require.NotNil(t, s.NextFetchAt())
		assert.Equal(t, now.Add(24*time.Hour), *s.NextFetchAt())
	})
}

func TestSubscription_RecordSuccess_ClearsFailuresAndAdvancesNextFetch(t *testing.T) {
	s, _ := NewSubscription(mustID(t), "https://example.com/feed", "t", IntervalHourly, time.Now())
	// 先制造一次失败
	s.RecordFailure(time.Now(), "网络错误")
	require.Equal(t, 1, s.ConsecutiveFailures())

	now := time.Now().Add(time.Minute)
	s.RecordSuccess(now)

	assert.Equal(t, 0, s.ConsecutiveFailures(), "成功应清零失败计数")
	assert.Empty(t, s.LastError())
	require.NotNil(t, s.LastFetchedAt())
	assert.Equal(t, now, *s.LastFetchedAt())
	require.NotNil(t, s.NextFetchAt())
	assert.Equal(t, now.Add(time.Hour), *s.NextFetchAt(), "应按 interval 推进")
}

func TestSubscription_RecordFailure_AutoPausesAtThreshold(t *testing.T) {
	s, _ := NewSubscription(mustID(t), "https://example.com/feed", "t", IntervalDaily, time.Now())
	now := time.Now()

	// 前 4 次：仍 active
	for i := 1; i < MaxConsecutiveFailures; i++ {
		paused := s.RecordFailure(now, "5xx")
		assert.False(t, paused, "第 %d 次失败不应触发暂停", i)
		assert.Equal(t, StatusActive, s.Status())
	}
	// 第 5 次：触发暂停
	paused := s.RecordFailure(now, "5xx")
	assert.True(t, paused, "达阈值应触发自动暂停")
	assert.Equal(t, StatusPaused, s.Status())
	assert.Equal(t, MaxConsecutiveFailures, s.ConsecutiveFailures())
	assert.Equal(t, "5xx", s.LastError())
}

func TestSubscription_PauseAndResume(t *testing.T) {
	s, _ := NewSubscription(mustID(t), "https://example.com/feed", "t", IntervalDaily, time.Now())

	// 制造失败计数
	s.RecordFailure(time.Now(), "err")
	require.Equal(t, 1, s.ConsecutiveFailures())

	s.Pause()
	assert.Equal(t, StatusPaused, s.Status())
	assert.Equal(t, 1, s.ConsecutiveFailures(), "Pause 不清零失败计数（只 Resume 清）")

	s.Resume()
	assert.Equal(t, StatusActive, s.Status())
	assert.Equal(t, 0, s.ConsecutiveFailures(), "Resume 应清零失败计数")
	assert.Empty(t, s.LastError())
}

func TestSubscription_SetRetryAfter(t *testing.T) {
	s, _ := NewSubscription(mustID(t), "https://example.com/feed", "t", IntervalHourly, time.Now())
	until := time.Now().Add(30 * time.Minute)
	s.SetRetryAfter(until)
	require.NotNil(t, s.RetryAfterUntil())
	assert.Equal(t, until, *s.RetryAfterUntil())
}

func TestSubscription_IsDue(t *testing.T) {
	uid := mustID(t)
	now := time.Now()

	t.Run("active 且 nextFetchAt 已过 → due", func(t *testing.T) {
		// nextFetchAt = now（已到）
		s := Reconstruct(mustID(t), uid, SourceTypeRSS, "https://x/feed", "t", IntervalHourly,
			false, "", nil, StatusActive, 0, "", nil, &now, nil, now, now)
		assert.True(t, s.IsDue(now))
	})

	t.Run("paused → 不 due", func(t *testing.T) {
		future := now.Add(time.Hour)
		s := Reconstruct(mustID(t), uid, SourceTypeRSS, "https://x/feed", "t", IntervalHourly,
			false, "", nil, StatusPaused, 0, "", nil, &future, nil, now, now)
		assert.False(t, s.IsDue(now))
	})

	t.Run("retryAfterUntil 未过 → 不 due", func(t *testing.T) {
		future := now.Add(30 * time.Minute) // Retry-After 到未来某点
		s := Reconstruct(mustID(t), uid, SourceTypeRSS, "https://x/feed", "t", IntervalHourly,
			false, "", nil, StatusActive, 0, "", nil, &now, &future, now, now)
		assert.False(t, s.IsDue(now), "Retry-After 未过不应抓")
	})

	t.Run("nextFetchAt 未到 → 不 due", func(t *testing.T) {
		future := now.Add(time.Hour)
		s := Reconstruct(mustID(t), uid, SourceTypeRSS, "https://x/feed", "t", IntervalHourly,
			false, "", nil, StatusActive, 0, "", nil, nil, &future, now, now)
		assert.False(t, s.IsDue(now))
	})
}

func TestSubscription_UpdateConfig(t *testing.T) {
	s, _ := NewSubscription(mustID(t), "https://example.com/feed", "t", IntervalDaily, time.Now())

	err := s.UpdateConfig("新标题", IntervalWeekly, true, "https://override/canonical", []string{"转载"})
	require.NoError(t, err)
	assert.Equal(t, "新标题", s.Title())
	assert.Equal(t, IntervalWeekly, s.Interval())
	assert.True(t, s.AutoPublish())
	assert.Equal(t, "https://override/canonical", s.CanonicalOverride())
	assert.Equal(t, []string{"转载"}, s.Tags())

	t.Run("拒绝非法 interval", func(t *testing.T) {
		err := s.UpdateConfig("t", "bad", false, "", nil)
		assert.Error(t, err)
	})
}
