package roadmap

import (
	"strings"
	"testing"
	"time"

	"blog-api/internal/domain/shared"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestItemContentValidation(t *testing.T) {
	now := time.Date(2026, 10, 18, 10, 0, 0, 0, time.UTC)
	for _, tc := range []struct {
		name    string
		content Content
		stage   Stage
	}{
		{"blank title", Content{Title: " \n\t "}, Planned},
		{"invalid stage", Content{Title: "Title"}, "unknown"},
		{"unfinished version", Content{Title: "Title", DeliveredVersion: "v1"}, InProgress},
		{"unfinished date", Content{Title: "Title", CompletionDate: &now}, Planned},
		{"script URL", Content{Title: "Title", Links: []Link{{URL: "javascript:alert(1)"}}}, Planned},
		{"protocol-relative URL", Content{Title: "Title", Links: []Link{{URL: "//evil.example"}}}, Planned},
		{"backslash URL", Content{Title: "Title", Links: []Link{{URL: "/\\evil.example"}}}, Planned},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := NewItem(shared.NewID(), shared.NewID(), 1, tc.content, tc.stage, "V", now)
			require.Error(t, err)
		})
	}

	item, err := NewItem(shared.NewID(), shared.NewID(), 1, Content{Title: "  Title  ",
		Description: "<strong>literal text</strong>", Tags: []string{" API ", "API", "", "Web"},
		Links: []Link{{URL: "/posts/example"}, {Label: "PR", URL: "https://github.com/example/repo/pull/1"}}}, Planned, "V", now)
	require.NoError(t, err)
	assert.Equal(t, "Title", item.Title())
	assert.Equal(t, "<strong>literal text</strong>", item.Description())
	assert.Equal(t, []string{"API", "Web"}, item.Tags())
	assert.Len(t, item.Links(), 2)
	assert.Nil(t, item.CompletionDate())
}

func TestItemCompletionAndDefensiveCopies(t *testing.T) {
	location := time.FixedZone("Asia/Shanghai", 8*3600)
	now := time.Date(2026, 10, 19, 0, 30, 0, 0, location)
	item, err := NewItem(shared.NewID(), shared.NewID(), 1, Content{Title: "Done", Tags: []string{"API"},
		Links: []Link{{URL: "/projects"}}, DeliveredVersion: "v2"}, Completed, "V", now)
	require.NoError(t, err)
	assert.Equal(t, "2026-10-19", item.CompletionDate().Format(time.DateOnly))
	assert.Equal(t, "v2", item.DeliveredVersion())
	item.Tags()[0] = "mutated"
	item.Links()[0].URL = "changed"
	date := item.CompletionDate()
	*date = date.AddDate(0, 0, 1)
	assert.Equal(t, "API", item.Tags()[0])
	assert.Equal(t, "/projects", item.Links()[0].URL)
	assert.Equal(t, "2026-10-19", item.CompletionDate().Format(time.DateOnly))
}

func TestItemOnlyRecordsActualContentChanges(t *testing.T) {
	now := time.Now()
	item, err := NewItem(shared.NewID(), shared.NewID(), 1, Content{Title: "Title"}, Planned, "V", now)
	require.NoError(t, err)
	created := item.PullEvents()
	require.Len(t, created, 1)
	assert.Equal(t, "roadmap.item.created", created[0].EventName())
	require.NoError(t, item.UpdateContent(Content{Title: "Title"}, now.Add(time.Minute)))
	assert.Empty(t, item.PullEvents())
	assert.Equal(t, now, item.UpdatedAt())
	require.NoError(t, item.UpdateContent(Content{Title: "Renamed", Tags: []string{"new"}}, now.Add(time.Minute)))
	events := item.PullEvents()
	require.Len(t, events, 1)
	updated := events[0].(ItemUpdated)
	assert.Equal(t, item.ProjectID(), updated.ProjectID)
	assert.Equal(t, int64(1), updated.Number)
	assert.Equal(t, []Change{{Field: "title", From: "Title", To: "Renamed"}, {Field: "tags", From: "[]", To: `["new"]`}}, updated.Changes)
}

func TestItemChecklistValidationAndNormalization(t *testing.T) {
	now := time.Now()
	tooMany := make([]ChecklistItem, MaxChecklistItems+1)
	for i := range tooMany {
		tooMany[i] = ChecklistItem{Text: "step"}
	}
	for _, tc := range []struct {
		name      string
		checklist []ChecklistItem
	}{
		{"blank text", []ChecklistItem{{Text: "ok"}, {Text: " \n "}}},
		{"too long", []ChecklistItem{{Text: strings.Repeat("长", MaxChecklistTextRunes+1)}}},
		{"too many", tooMany},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := NewItem(shared.NewID(), shared.NewID(), 1, Content{Title: "Title", Checklist: tc.checklist}, Planned, "V", now)
			require.Error(t, err)
		})
	}

	input := []ChecklistItem{{Text: "  first  ", Done: true}, {Text: strings.Repeat("长", MaxChecklistTextRunes)}}
	item, err := NewItem(shared.NewID(), shared.NewID(), 1, Content{Title: "Title", Checklist: input}, Planned, "V", now)
	require.NoError(t, err)
	assert.Equal(t, "first", item.Checklist()[0].Text)
	assert.True(t, item.Checklist()[0].Done)
	assert.Len(t, item.Checklist(), 2)
	input[0].Text = "mutated"
	item.Checklist()[1].Done = true
	assert.Equal(t, "first", item.Checklist()[0].Text, "条目不共享调用方的切片")
	assert.False(t, item.Checklist()[1].Done, "读取返回副本")

	empty, err := NewItem(shared.NewID(), shared.NewID(), 2, Content{Title: "Plain"}, Planned, "W", now)
	require.NoError(t, err)
	assert.NotNil(t, empty.Checklist())
	assert.Empty(t, empty.Checklist())
}

func TestItemRecordsChecklistChanges(t *testing.T) {
	now := time.Now()
	item, err := NewItem(shared.NewID(), shared.NewID(), 1, Content{Title: "Title",
		Checklist: []ChecklistItem{{Text: "a"}, {Text: "b"}}}, Planned, "V", now)
	require.NoError(t, err)
	item.PullEvents()

	require.NoError(t, item.UpdateContent(Content{Title: "Title",
		Checklist: []ChecklistItem{{Text: "a"}, {Text: "b"}}}, now.Add(time.Minute)))
	assert.Empty(t, item.PullEvents(), "子项没变化不产生事件")

	require.NoError(t, item.UpdateContent(Content{Title: "Title",
		Checklist: []ChecklistItem{{Text: "a", Done: true}, {Text: "b"}}}, now.Add(time.Minute)))
	events := item.PullEvents()
	require.Len(t, events, 1)
	changes := events[0].(ItemUpdated).Changes
	require.Len(t, changes, 1)
	assert.Equal(t, "checklist", changes[0].Field)
	assert.Equal(t, `[{"text":"a","done":false},{"text":"b","done":false}]`, changes[0].From)
	assert.Equal(t, `[{"text":"a","done":true},{"text":"b","done":false}]`, changes[0].To)

	require.NoError(t, item.UpdateContent(Content{Title: "Title"}, now.Add(2*time.Minute)))
	assert.Empty(t, item.Checklist(), "省略子项等于清空")
}
