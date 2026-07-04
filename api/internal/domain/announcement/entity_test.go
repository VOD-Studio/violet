package announcement

import (
	"testing"
	"time"
)

func TestIsValidSeverity(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"info", true}, {"warning", true}, {"success", true}, {"error", true},
		{"INFO", false}, {"", false}, {"unknown", false},
	}
	for _, c := range cases {
		if got := IsValidSeverity(c.in); got != c.want {
			t.Errorf("IsValidSeverity(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestIsValidDisplay(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"banner", true}, {"card", true}, {"article", true},
		{"BANNER", false}, {"", false}, {"modal", false},
	}
	for _, c := range cases {
		if got := IsValidDisplay(c.in); got != c.want {
			t.Errorf("IsValidDisplay(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestNewAnnouncement_Validation(t *testing.T) {
	cases := []struct {
		name, title, content, severity string
		wantErr                        bool
	}{
		{"valid", "标题", "内容", "info", false},
		{"empty title", "", "内容", "info", true},
		{"empty content", "标题", "", "info", true},
		{"invalid severity", "标题", "内容", "critical", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			a, err := NewAnnouncement(1, c.title, c.content, c.severity)
			if (err != nil) != c.wantErr {
				t.Fatalf("err = %v, wantErr %v", err, c.wantErr)
			}
			if !c.wantErr && a == nil {
				t.Fatal("expected non-nil announcement")
			}
		})
	}
}

func TestNewAnnouncement_Defaults(t *testing.T) {
	a, _ := NewAnnouncement(1, "标题", "内容", "info")
	if a.Display() != DisplayBanner {
		t.Errorf("default display = %q, want %q", a.Display(), DisplayBanner)
	}
	if !a.IsActive() {
		t.Error("default isActive should be true")
	}
	if a.SortOrder() != 0 {
		t.Errorf("default sortOrder = %d, want 0", a.SortOrder())
	}
}

func TestSetDisplay(t *testing.T) {
	a, _ := NewAnnouncement(1, "t", "c", "info")
	if err := a.SetDisplay(DisplayCard); err != nil {
		t.Fatalf("SetDisplay(card) err = %v", err)
	}
	if a.Display() != DisplayCard {
		t.Errorf("display = %q, want card", a.Display())
	}
	if err := a.SetDisplay("invalid"); err == nil {
		t.Error("SetDisplay(invalid) should error")
	}
}

func TestSetTimeRange(t *testing.T) {
	a, _ := NewAnnouncement(1, "t", "c", "info")
	start := time.Date(2026, 7, 6, 2, 0, 0, 0, time.UTC)
	end := time.Date(2026, 7, 6, 4, 0, 0, 0, time.UTC)

	if err := a.SetTimeRange(&start, &end); err != nil {
		t.Fatalf("valid range err = %v", err)
	}
	if err := a.SetTimeRange(&end, &start); err == nil {
		t.Error("start > end should error")
	}
}

func TestIsCurrentlyActive_TimeWindow(t *testing.T) {
	start := time.Date(2026, 7, 6, 2, 0, 0, 0, time.UTC)
	end := time.Date(2026, 7, 6, 4, 0, 0, 0, time.UTC)
	cases := []struct {
		name    string
		active  bool
		start   *time.Time
		end     *time.Time
		now     time.Time
		wantAct bool
	}{
		{"inactive overrides all", false, &start, &end, start, false},
		{"before window", true, &start, &end, start.Add(-time.Hour), false},
		{"after window", true, &start, &end, end.Add(time.Hour), false},
		{"in window start edge", true, &start, &end, start, true},
		{"in window end edge", true, &start, &end, end, true},
		{"no window active", true, nil, nil, time.Now(), true},
		{"only start not yet", true, &start, nil, start.Add(-time.Hour), false},
		{"only end passed", true, nil, &end, end.Add(time.Hour), false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			a, _ := NewAnnouncement(1, "t", "c", "info")
			a.SetActive(c.active)
			_ = a.SetTimeRange(c.start, c.end)
			if got := a.IsCurrentlyActive(c.now); got != c.wantAct {
				t.Errorf("IsCurrentlyActive = %v, want %v", got, c.wantAct)
			}
		})
	}
}

func TestUpdate(t *testing.T) {
	a, _ := NewAnnouncement(1, "原标题", "原内容", "info")
	if err := a.Update("", "新内容", "warning"); err == nil {
		t.Error("empty title should error")
	}
	if err := a.Update("新标题", "新内容", "warning"); err != nil {
		t.Fatalf("Update err = %v", err)
	}
	if a.Title() != "新标题" || a.Severity() != "warning" {
		t.Errorf("after update: title=%q severity=%q", a.Title(), a.Severity())
	}
	if err := a.Update("标题", "内容", "critical"); err == nil {
		t.Error("invalid severity should error")
	}
}

func TestAffectsJSON_RoundTrip(t *testing.T) {
	a, _ := NewAnnouncement(1, "t", "c", "info")
	a.SetAffects([]string{"comments", "auth"})
	json := a.AffectsJSON()
	if json == "" {
		t.Fatal("AffectsJSON should not be empty")
	}
	parsed := ParseAffects(json)
	if len(parsed) != 2 || parsed[0] != "comments" || parsed[1] != "auth" {
		t.Errorf("ParseAffects round-trip = %v", parsed)
	}
}

func TestParseAffects_Empty(t *testing.T) {
	if got := ParseAffects(""); got != nil {
		t.Errorf("ParseAffects(\"\") = %v, want nil", got)
	}
	if got := ParseAffects("not json"); got != nil {
		t.Errorf("ParseAffects(invalid) = %v, want nil", got)
	}
}
