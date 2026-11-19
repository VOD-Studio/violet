package publicprofile

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
)

type profileUsers struct {
	user.UserRepository
	users map[string]*user.User
}

func (r profileUsers) FindByUsername(_ context.Context, name user.Username) (*user.User, error) {
	u := r.users[name.String()]
	if u == nil {
		return nil, user.ErrNotFound
	}
	return u, nil
}

type profileReader struct {
	rows     []Activity
	position Position
	limit    int
}

func (r *profileReader) Summary(context.Context, shared.ID, time.Time, time.Time) (Stats, []Day, error) {
	return Stats{Tweets: 27, ReceivedLikes: 31}, []Day{{Date: "2026-05-18", Count: 2}, {Date: "2026-11-18", Count: 1}}, nil
}
func (r *profileReader) Activities(_ context.Context, _ shared.ID, _ string, position Position, limit int) ([]Activity, error) {
	r.position, r.limit = position, limit
	return r.rows, nil
}
func testProfileUser(t *testing.T, name string) *user.User {
	t.Helper()
	email, err := user.ParseEmail(name + "@example.com")
	require.NoError(t, err)
	username, err := user.ParseUsername(name)
	require.NoError(t, err)
	return user.NewUser(shared.NewID(), email, username, user.NewPasswordHash(""))
}

func TestProfileCalendarIncludesEmptyDaysAndExplicitUTCBoundaries(t *testing.T) {
	u := testProfileUser(t, "alice")
	u.UpdateCoverURL("https://example.com/cover.gif?crop=1,2,3,4")
	svc := NewService(profileUsers{users: map[string]*user.User{"alice": u}}, &profileReader{})
	svc.now = func() time.Time { return time.Date(2026, 11, 18, 1, 0, 0, 0, time.FixedZone("UTC+8", 8*3600)) }
	profile, err := svc.Get(context.Background(), "alice")
	require.NoError(t, err)
	assert.Equal(t, "UTC", profile.Activity.Timezone)
	assert.Equal(t, "2026-05-17", profile.Activity.StartDate)
	assert.Equal(t, "2026-11-17", profile.Activity.EndDate)
	assert.Equal(t, "2026-05-17", profile.Activity.Days[0].Date)
	assert.Zero(t, profile.Activity.Days[0].Count)
	assert.Equal(t, int64(2), profile.Activity.Total)
	assert.Equal(t, int64(27), profile.Stats.Tweets)
	assert.Equal(t, u.CoverURL(), profile.CoverURL)
	assert.Empty(t, profile.PublicReadingPreferences)
	_, err = svc.Get(context.Background(), "deleted_user")
	assert.ErrorIs(t, err, user.ErrNotFound)
}

func TestActivityCursorBindsAccountTabAndSnapshot(t *testing.T) {
	u := testProfileUser(t, "alice")
	now := time.Date(2026, 11, 18, 12, 0, 0, 0, time.UTC)
	reader := &profileReader{rows: []Activity{
		{ID: shared.NewID().String(), CreatedAt: now.Add(-time.Hour), Order: 5},
		{ID: shared.NewID().String(), CreatedAt: now.Add(-time.Hour), Order: 4},
	}}
	svc := NewService(profileUsers{users: map[string]*user.User{"alice": u, "bob": testProfileUser(t, "bob")}}, reader)
	svc.now = func() time.Time { return now }
	items, cursor, err := svc.List(context.Background(), "alice", "all", "", 1)
	require.NoError(t, err)
	require.Len(t, items, 1)
	require.NotEmpty(t, cursor)
	reader.rows = nil
	_, _, err = svc.List(context.Background(), "alice", "all", cursor, 200)
	require.NoError(t, err)
	assert.Equal(t, 51, reader.limit)
	assert.Equal(t, items[0].ID, reader.position.ID)
	assert.Equal(t, 5, reader.position.Type)
	assert.True(t, now.Equal(reader.position.Snapshot))
	for _, tc := range []struct{ name, tab, cursor string }{
		{"bob", "all", cursor}, {"alice", "tweets", cursor}, {"alice", "all", "garbage"}, {"alice", "private", ""},
	} {
		_, _, err := svc.List(context.Background(), tc.name, tc.tab, tc.cursor, 20)
		require.Error(t, err)
	}
}

func TestProfileCalendarClampsEndOfMonth(t *testing.T) {
	u := testProfileUser(t, "alice")
	svc := NewService(profileUsers{users: map[string]*user.User{"alice": u}}, &profileReader{})
	svc.now = func() time.Time { return time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC) }
	profile, err := svc.Get(context.Background(), "alice")
	require.NoError(t, err)
	assert.Equal(t, "2026-02-28", profile.Activity.StartDate)
	assert.Equal(t, "2026-08-31", profile.Activity.EndDate)
}
