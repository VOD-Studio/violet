package runtimelog

import (
	"context"
	"testing"
	"time"

	domainlog "blog-api/internal/domain/runtimelog"
	"github.com/stretchr/testify/require"
)

type serviceStoreStub struct {
	bounds      domainlog.Bounds
	readEntries []domainlog.Entry
	walkEntries []domainlog.Entry
	walkFilter  domainlog.Filter
}

func (*serviceStoreStub) Append(context.Context, []domainlog.Entry) error { return nil }

func (s *serviceStoreStub) ReadPage(context.Context, domainlog.Filter) (domainlog.Bounds, []domainlog.Entry, error) {
	return s.bounds, append([]domainlog.Entry(nil), s.readEntries...), nil
}

func (s *serviceStoreStub) Walk(_ context.Context, filter domainlog.Filter, visit func(domainlog.Entry) error) error {
	s.walkFilter = filter
	for _, entry := range s.walkEntries {
		if err := visit(entry); err != nil {
			return err
		}
	}
	return nil
}

func (s *serviceStoreStub) Bounds(context.Context) (domainlog.Bounds, error) {
	return s.bounds, nil
}

func TestListReturnsExplicitEmptyHandoffCursor(t *testing.T) {
	service := NewService(&serviceStoreStub{})
	page, err := service.List(context.Background(), domainlog.Filter{After: 42, AfterSet: true, Limit: 100})
	require.NoError(t, err)
	require.Empty(t, page.Items)
	require.Equal(t, "0", page.OldestCursor)
	require.Equal(t, "0", page.NewestCursor)
	require.True(t, page.Gap)
}

func TestListReportsGapAfterEmptyRotationWindow(t *testing.T) {
	service := NewService(&serviceStoreStub{bounds: domainlog.Bounds{Newest: 100}})
	page, err := service.List(context.Background(), domainlog.Filter{After: 50, AfterSet: true, Limit: 100})
	require.NoError(t, err)
	require.Empty(t, page.Items)
	require.Equal(t, "0", page.OldestCursor)
	require.Equal(t, "100", page.NewestCursor)
	require.True(t, page.Gap)
}

func TestListReportsCursorAheadOfCurrentWindow(t *testing.T) {
	service := NewService(&serviceStoreStub{bounds: domainlog.Bounds{Oldest: 10, Newest: 20}})
	page, err := service.List(context.Background(), domainlog.Filter{After: 21, AfterSet: true, Limit: 100})
	require.NoError(t, err)
	require.True(t, page.Gap)
	require.Equal(t, "10", page.OldestCursor)
	require.Equal(t, "20", page.NewestCursor)
}

func TestListReportsGapForExplicitZeroCursor(t *testing.T) {
	service := NewService(&serviceStoreStub{bounds: domainlog.Bounds{Oldest: 151, Newest: 250}})
	page, err := service.List(context.Background(), domainlog.Filter{AfterSet: true, Limit: 100})
	require.NoError(t, err)
	require.True(t, page.Gap)
}

func TestListDoesNotReportGapWithoutCursor(t *testing.T) {
	service := NewService(&serviceStoreStub{bounds: domainlog.Bounds{Oldest: 151, Newest: 250}})
	page, err := service.List(context.Background(), domainlog.Filter{Limit: 100})
	require.NoError(t, err)
	require.False(t, page.Gap)
}

func TestWalkExportPinsBoundaryAndDetectsRecordLimit(t *testing.T) {
	store := &serviceStoreStub{
		bounds: domainlog.Bounds{Oldest: 1, Newest: 3},
		walkEntries: []domainlog.Entry{
			{ID: 1}, {ID: 2}, {ID: 3},
		},
	}
	service := NewService(store)
	plan, err := service.PrepareExport(context.Background(), domainlog.Filter{Keyword: "probe"}, 2)
	require.NoError(t, err)
	var exported []int64
	result, err := service.WalkExport(context.Background(), plan, func(entry domainlog.Entry) (bool, error) {
		exported = append(exported, entry.ID)
		return true, nil
	})
	require.NoError(t, err)
	require.Equal(t, []int64{1, 2}, exported)
	require.Equal(t, 2, result.Exported)
	require.True(t, result.RecordLimitReached)
	require.Equal(t, int64(3), store.walkFilter.Through)
	require.True(t, store.walkFilter.Ascending)
}

func TestRetentionBoundaryIsInclusive(t *testing.T) {
	cutoff := time.Date(2026, 9, 10, 8, 0, 0, 0, time.UTC)
	oldest := cutoff
	policy := domainlog.Policy{MaxRecords: 100, MaxBytes: 1 << 20}
	usage := domainlog.Usage{Records: 100, PayloadBytes: 1 << 20, OldestReceivedAt: &oldest}
	require.False(t, exceedsPolicy(usage, policy, cutoff))
	before := cutoff.Add(-time.Nanosecond)
	usage.OldestReceivedAt = &before
	require.True(t, exceedsPolicy(usage, policy, cutoff))
}
