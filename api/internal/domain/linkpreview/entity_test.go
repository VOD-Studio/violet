package linkpreview

import (
	"strings"
	"testing"
	"time"

	"blog-api/internal/domain/shared"
)

var base = time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)

func newCard(t *testing.T) *LinkCard {
	t.Helper()
	card, err := NewLinkCard(shared.NewID(), "https://example.com/a", base)
	if err != nil {
		t.Fatalf("NewLinkCard: %v", err)
	}
	return card
}

func TestNewLinkCard(t *testing.T) {
	card := newCard(t)
	if card.Status() != StatusPending {
		t.Errorf("status = %q, want pending", card.Status())
	}
	// pending 卡片立即可抓。
	if !card.NeedRefresh(base) {
		t.Error("新建卡片应 NeedRefresh")
	}
	if card.Displayable() {
		t.Error("无快照不应可展示")
	}
}

func TestNewLinkCard_EmptyURL(t *testing.T) {
	if _, err := NewLinkCard(shared.NewID(), "  ", base); err == nil {
		t.Error("空 URL 应被拒绝")
	}
}

func TestRecordSuccess(t *testing.T) {
	card := newCard(t)
	later := base.Add(time.Hour)
	card.RecordSuccess("标题", "描述", "Example", "/uploads/link-previews/x/cover.webp", later, DefaultTTL)

	if card.Status() != StatusOK || card.FailCount() != 0 || card.LastError() != "" {
		t.Errorf("成功后状态未复位: status=%q failCount=%d lastError=%q", card.Status(), card.FailCount(), card.LastError())
	}
	if !card.Displayable() {
		t.Error("成功后应可展示")
	}
	if card.NeedRefresh(later.Add(DefaultTTL - time.Second)) {
		t.Error("TTL 内不应重抓")
	}
	if !card.NeedRefresh(later.Add(DefaultTTL + time.Second)) {
		t.Error("TTL 过后应重抓")
	}
}

func TestRecordFailure_Backoff(t *testing.T) {
	card := newCard(t)

	// 首次失败：从未成功 → failed，退避一个 base。
	first := base.Add(time.Minute)
	card.RecordFailure("timeout", first)
	if card.Status() != StatusFailed {
		t.Errorf("pending 失败后 status = %q, want failed", card.Status())
	}
	if card.NeedRefresh(first.Add(FailureBackoffBase - time.Second)) {
		t.Error("退避期内不应重抓")
	}
	if !card.NeedRefresh(first.Add(FailureBackoffBase + time.Second)) {
		t.Error("退避结束后应可重抓")
	}

	// 连续失败指数退避：第 3 次 = base*4。
	second := first.Add(FailureBackoffBase + time.Second)
	card.RecordFailure("dns", second)
	third := second.Add(4 * FailureBackoffBase)
	card.RecordFailure("refused", third)
	if backoff := card.ExpiresAt().Sub(third); backoff != 4*FailureBackoffBase {
		t.Errorf("第三次退避 = %v, want %v", backoff, 4*FailureBackoffBase)
	}
	if card.LastError() != "refused" {
		t.Errorf("lastError = %q, want 最近一次错误", card.LastError())
	}
}

func TestRecordFailure_KeepsOldSnapshot(t *testing.T) {
	card := newCard(t)
	okAt := base.Add(time.Hour)
	card.RecordSuccess("旧标题", "旧描述", "Example", "/uploads/link-previews/x/cover.webp", okAt, DefaultTTL)
	if !card.Displayable() {
		t.Fatal("前置：成功后应可展示")
	}

	// TTL 过后重抓失败：旧快照保留、继续展示，退避一个 base。
	failAt := okAt.Add(DefaultTTL + time.Minute)
	card.RecordFailure("upstream 5xx", failAt)
	if card.Status() != StatusOK {
		t.Errorf("有旧快照的卡片失败后 status = %q, want ok", card.Status())
	}
	if card.Title() != "旧标题" || card.ImageURL() == "" {
		t.Error("失败不应清空旧快照")
	}
	if !card.Displayable() {
		t.Error("旧快照应继续展示")
	}
	if !card.NeedRefresh(failAt.Add(FailureBackoffBase + time.Second)) {
		t.Error("退避结束后应可重抓")
	}

	// 退避结束后重抓成功：快照换新、失败计数清零。
	retryAt := failAt.Add(FailureBackoffBase + time.Minute)
	card.RecordSuccess("新标题", "", "", "/uploads/link-previews/x/cover2.webp", retryAt, DefaultTTL)
	if card.Title() != "新标题" || card.FailCount() != 0 {
		t.Errorf("重抓成功未复位: title=%q failCount=%d", card.Title(), card.FailCount())
	}
}

func TestRecordFailure_TruncatesError(t *testing.T) {
	card := newCard(t)
	card.RecordFailure(strings.Repeat("x", 500), base)
	if got := len(card.LastError()); got != MaxLastError {
		t.Errorf("lastError 长度 = %d, want %d", got, MaxLastError)
	}
}

func TestHasSnapshot(t *testing.T) {
	card := newCard(t)
	if card.HasSnapshot() {
		t.Error("空卡片无快照")
	}
	card.RecordSuccess("", "", "", "/uploads/link-previews/x/cover.webp", base, DefaultTTL)
	if !card.HasSnapshot() {
		t.Error("仅有封面也算快照")
	}
}
