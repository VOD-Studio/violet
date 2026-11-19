package journal

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	appnote "blog-api/internal/application/note"
	domainnote "blog-api/internal/domain/note"
	activity "blog-api/internal/domain/repositoryactivity"
	"blog-api/internal/domain/shared"
)

type noteRows struct {
	domainnote.Repository
	rows []domainnote.PublishedNote
}

func (r noteRows) FindPublishedPage(_ context.Context, before *domainnote.PublishedCursor, _ domainnote.BrowseFilter, limit int) ([]domainnote.PublishedNote, error) {
	var page []domainnote.PublishedNote
	for _, row := range r.rows {
		if before != nil && (row.PublishedAt.After(before.PublishedAt) ||
			(row.PublishedAt.Equal(before.PublishedAt) && row.ID.String() >= before.ID.String())) {
			continue
		}
		page = append(page, row)
		if len(page) == limit {
			break
		}
	}
	return page, nil
}

type progressRows struct {
	ProgressReader
	rows []activity.Day
	err  error
}

func (r *progressRows) Browse(_ context.Context, _ *shared.ID, before *activity.Cursor, limit int) ([]activity.Day, activity.Health, error) {
	if r.err != nil {
		return nil, activity.Health{}, r.err
	}
	var page []activity.Day
	for _, row := range r.rows {
		if before != nil && (row.Day > before.Day ||
			(row.Day == before.Day && row.Project.ID >= before.ProjectID.String())) {
			continue
		}
		page = append(page, row)
		if len(page) == limit {
			break
		}
	}
	return page, activity.Health{State: activity.StateReady}, nil
}

const (
	smallID = "42000000-0000-0000-0000-000000000001"
	largeID = "42000000-0000-0000-0000-000000000002"
)

func published(t *testing.T, title, id, when string) domainnote.PublishedNote {
	t.Helper()
	at, err := time.Parse(time.RFC3339Nano, when)
	require.NoError(t, err)
	return domainnote.PublishedNote{ID: shared.MustParseID(id), Title: title, PublishedAt: at}
}

func progressDay(day, title, id string) activity.Day {
	return activity.Day{Day: day, Project: activity.Project{ID: id, Title: title}}
}

func TestBrowsePaginatesAcrossProjectTiesAndShanghaiMidnight(t *testing.T) {
	service := NewService(appnote.NewService(noteRows{rows: []domainnote.PublishedNote{
		published(t, "刚过零点的小 ID", smallID, "2026-11-18T16:00:00.002Z"),
		published(t, "刚过零点的大 ID", largeID, "2026-11-18T16:00:00.001Z"),
		published(t, "前一天的手记", smallID, "2026-11-18T15:59:59.999Z"),
	}}, nil), &progressRows{rows: []activity.Day{
		progressDay("2026-11-19", "同日项目二", largeID),
		progressDay("2026-11-19", "同日项目一", smallID),
		progressDay("2026-11-18", "前一天的项目进展", smallID),
	}}, nil)

	var cursor string
	for _, want := range []string{"同日项目二", "同日项目一", "刚过零点的小 ID", "刚过零点的大 ID", "前一天的项目进展", "前一天的手记"} {
		page, err := service.Browse(t.Context(), Query{Cursor: cursor, Limit: 1})
		require.NoError(t, err)
		require.Len(t, page.Entries, 1)
		entry := page.Entries[0]
		if entry.Note != nil {
			require.Equal(t, want, entry.Note.Title)
		} else {
			require.NotNil(t, entry.Progress)
			require.Equal(t, want, entry.Progress.Project.Title)
		}
		if want == "前一天的手记" {
			require.Nil(t, page.NextCursor)
		} else {
			require.NotNil(t, page.NextCursor)
			cursor = *page.NextCursor
		}
	}
}

func TestBrowseKeepsNotesAvailableWithoutBackfillingScrolledDays(t *testing.T) {
	source := &progressRows{err: errors.New("cache unavailable")}
	service := NewService(appnote.NewService(noteRows{rows: []domainnote.PublishedNote{
		published(t, "先看到的手记", largeID, "2026-11-18T18:02:00Z"),
		published(t, "下一页手记", smallID, "2026-11-18T13:02:00Z"),
	}}, nil), source, nil)

	first, err := service.Browse(t.Context(), Query{Limit: 1})
	require.NoError(t, err)
	require.Equal(t, activity.StateFailed, first.Progress.State)
	require.Equal(t, "先看到的手记", first.Entries[0].Note.Title)
	require.NotNil(t, first.NextCursor)

	source.err = nil
	source.rows = []activity.Day{
		progressDay("2026-11-19", "已经翻过的日期", largeID),
		progressDay("2026-11-18", "可以接着展示的日期", smallID),
	}
	second, err := service.Browse(t.Context(), Query{Limit: 5, Cursor: *first.NextCursor})
	require.NoError(t, err)
	require.Len(t, second.Entries, 2)
	require.Equal(t, "可以接着展示的日期", second.Entries[0].Progress.Project.Title)
	require.Equal(t, "下一页手记", second.Entries[1].Note.Title)
}
