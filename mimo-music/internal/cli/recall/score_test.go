package recall

import (
	"math"
	"testing"
	"time"
)

func TestScore_NilForEmpty(t *testing.T) {
	if got := Score(nil, time.Now()); got != nil {
		t.Errorf("Score(nil) = %v, want nil", got)
	}
}

func TestScore_AggregatesByID(t *testing.T) {
	now := time.Date(2026, 7, 24, 20, 0, 0, 0, time.UTC)
	// 同一 id 两次 play(都 1h 内 ×4)+ 一次 search(1h 内 ×2)。
	events := []Event{
		{ID: 1, Name: "晴天", Src: SrcPlay, TS: now.Add(-10 * time.Minute)},
		{ID: 1, Name: "晴天", Src: SrcPlay, TS: now.Add(-5 * time.Minute)},
		{ID: 1, Name: "晴天", Src: SrcSearch, TS: now.Add(-1 * time.Minute)},
	}
	ranked := Score(events, now)
	if len(ranked) != 1 {
		t.Fatalf("应聚合成 1 个候选,got %d", len(ranked))
	}
	// score = 2×(4×4) + 1×(2×4) = 32 + 8 = 40(play×2 各 16,search 8)。
	want := 4.0*4 + 4.0*4 + 2.0*4
	if math.Abs(ranked[0].Score-want) > 1e-9 {
		t.Errorf("score = %v, want %v", ranked[0].Score, want)
	}
}

func TestScore_FrecencyRecencyDominates(t *testing.T) {
	// 常听歌(多次但较早)vs 碰巧一次(刚发生):验证 play 权重 + 时段桶让常听的靠前。
	now := time.Date(2026, 7, 24, 20, 0, 0, 0, time.UTC)
	frequentOld := Event{ID: 1, Name: "常听", Src: SrcPlay, TS: now.Add(-3 * 24 * time.Hour)} // 本周 ×0.5
	rareRecent := Event{ID: 2, Name: "刚听", Src: SrcRemote, TS: now.Add(-5 * time.Minute)}   // 1h 内 ×4
	// 频繁老:5 次 play × (4 × 0.5) = 10。刚听:1 次 remote × (1 × 4) = 4。常听应靠前。
	events := []Event{}
	for i := 0; i < 5; i++ {
		events = append(events, frequentOld)
	}
	events = append(events, rareRecent)
	ranked := Score(events, now)
	if len(ranked) != 2 {
		t.Fatalf("got %d 候选,want 2", len(ranked))
	}
	if ranked[0].Event.ID != 1 {
		t.Errorf("常听(id=1,score=%v)应排第一,实际第一 id=%d score=%v",
			ranked[0].Score, ranked[0].Event.ID, ranked[0].Score)
	}
}

func TestScore_SrcWeightOrdering(t *testing.T) {
	// 同一时段桶下,play > search > remote。
	now := time.Date(2026, 7, 24, 20, 0, 0, 0, time.UTC)
	ts := now.Add(-10 * time.Minute) // 都在 1h 内 ×4,纯比 src 权重
	events := []Event{
		{ID: 3, Src: SrcRemote, TS: ts},
		{ID: 2, Src: SrcSearch, TS: ts},
		{ID: 1, Src: SrcPlay, TS: ts},
	}
	ranked := Score(events, now)
	if ranked[0].Event.ID != 1 || ranked[1].Event.ID != 2 || ranked[2].Event.ID != 3 {
		ids := []int64{ranked[0].Event.ID, ranked[1].Event.ID, ranked[2].Event.ID}
		t.Errorf("排序应为 play>search>remote [1,2,3],got %v", ids)
	}
}

func TestScore_TimeBuckets(t *testing.T) {
	now := time.Date(2026, 7, 24, 20, 0, 0, 0, time.UTC)
	cases := []struct {
		name string
		age  time.Duration
		want float64
	}{
		{"under_1h", 10 * time.Minute, 4},
		{"under_1d", 2 * time.Hour, 2},
		{"under_1w", 3 * 24 * time.Hour, 0.5},
		{"older", 30 * 24 * time.Hour, 0.25},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := timeBucket(now.Add(-tc.age), now); got != tc.want {
				t.Errorf("timeBucket(age=%v) = %v, want %v", tc.age, got, tc.want)
			}
		})
	}
}

func TestScore_TiebreakByID(t *testing.T) {
	// score 相同(同 src 同时段)→ id 升序。
	now := time.Date(2026, 7, 24, 20, 0, 0, 0, time.UTC)
	ts := now.Add(-10 * time.Minute)
	events := []Event{
		{ID: 30, Src: SrcPlay, TS: ts},
		{ID: 10, Src: SrcPlay, TS: ts},
		{ID: 20, Src: SrcPlay, TS: ts},
	}
	ranked := Score(events, now)
	for i, r := range ranked {
		// 期望 10,20,30
		want := int64((i + 1) * 10)
		if r.Event.ID != want {
			t.Errorf("位置 %d: id=%d, want %d", i, r.Event.ID, want)
		}
	}
}

func TestScore_RepresentativeEventPicksLatestNonEmptyName(t *testing.T) {
	now := time.Date(2026, 7, 24, 20, 0, 0, 0, time.UTC)
	events := []Event{
		{ID: 1, Name: "", Artist: "", Src: SrcSearch, TS: now.Add(-2 * time.Hour)}, // 老,无 name
		{ID: 1, Name: "晴天", Artist: "周杰伦", Src: SrcPlay, TS: now.Add(-5 * time.Minute)}, // 新,有 name
	}
	ranked := Score(events, now)
	if ranked[0].Event.Name != "晴天" || ranked[0].Event.Artist != "周杰伦" {
		t.Errorf("代表性事件应取最新非空 name,got name=%q artist=%q",
			ranked[0].Event.Name, ranked[0].Event.Artist)
	}
}
