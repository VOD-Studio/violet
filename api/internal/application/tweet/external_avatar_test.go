package tweet

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
)

type avatarRefreshRepo struct {
	domaintweet.ExternalRepository
	external *domaintweet.ExternalTweet
}

func (r *avatarRefreshRepo) Ensure(context.Context, string, time.Time) (*domaintweet.ExternalTweet, error) {
	return r.external, nil
}

func (r *avatarRefreshRepo) FindByID(context.Context, shared.ID) (*domaintweet.ExternalTweet, error) {
	return r.external, nil
}

func (r *avatarRefreshRepo) FindByIDs(context.Context, []shared.ID) ([]*domaintweet.ExternalTweet, error) {
	return []*domaintweet.ExternalTweet{r.external}, nil
}

func (r *avatarRefreshRepo) SaveSnapshot(_ context.Context, ext *domaintweet.ExternalTweet, _ string) (bool, error) {
	r.external = ext
	return true, nil
}

type avatarRefreshFetcher struct{ result *ExternalFetchResult }

func (f avatarRefreshFetcher) Fetch(context.Context, string) (*ExternalFetchResult, error) {
	return f.result, nil
}

type avatarRefreshMedia struct{ ExternalMediaStore }

func (avatarRefreshMedia) Prepare(_ context.Context, id, version string, snapshot *domaintweet.ExternalSnapshot, _ *int64) error {
	snapshot.Author.AvatarURL = "/uploads/external-tweets/" + id + "/" + version + "/avatar.jpg"
	return nil
}

type avatarRefreshPreviews struct{ ExternalPreviewStore }

func (avatarRefreshPreviews) GetFailure(context.Context, string) (*ExternalFetchError, error) {
	return nil, nil
}

func TestRefreshExternalRepairsMissingAvatarWithoutSourceChanges(t *testing.T) {
	for _, tc := range []struct {
		name, source, avatar string
		repaired             bool
	}{
		{"missing_local_avatar", "https://pbs.twimg.com/profile_images/avatar.jpg", "", true},
		{"already_saved", "https://pbs.twimg.com/profile_images/avatar.jpg", "/uploads/external-tweets/existing/avatar.jpg", false},
		{"no_source_avatar", "", "", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fetched := &ExternalFetchResult{
				SourceID: "2104838506363408740", CanonicalURL: "https://x.com/i/status/2104838506363408740",
				Availability: domaintweet.ExternalAvailable, FetchSource: "fxtwitter",
				Snapshot: &domaintweet.ExternalSnapshot{
					Author: domaintweet.ExternalAuthor{Name: "Original author", AvatarSourceURL: tc.source},
					Text:   "unchanged source", Completeness: domaintweet.TextComplete,
					Warnings: []string{"投票请在 X 查看"},
				},
			}
			data, err := json.Marshal(struct {
				Snapshot *domaintweet.ExternalSnapshot
				QuoteID  *string
			}{Snapshot: fetched.Snapshot})
			require.NoError(t, err)
			hash := sha256.Sum256(data)
			oldSnapshot := *fetched.Snapshot
			oldSnapshot.Author.AvatarURL = tc.avatar
			if tc.repaired {
				oldSnapshot.Warnings = append(append([]string{}, oldSnapshot.Warnings...), "原作者头像暂不可用")
			}
			oldVersion := uuid.NewString()
			repo := &avatarRefreshRepo{external: &domaintweet.ExternalTweet{
				ID: shared.NewID(), SourceID: fetched.SourceID, CanonicalURL: fetched.CanonicalURL,
				Version: oldVersion, Snapshot: &oldSnapshot, Availability: domaintweet.ExternalAvailable,
				Fingerprint: hex.EncodeToString(hash[:]), FetchedAt: time.Now(),
			}}
			ext := NewExternalService(repo, avatarRefreshFetcher{fetched}, avatarRefreshMedia{}, avatarRefreshPreviews{})
			svc := &Service{external: ext}
			dto, err := svc.RefreshExternal(ctxWithUser(shared.NewID().String(), "superadmin", true), repo.external.ID.String())
			require.NoError(t, err)
			require.NotNil(t, dto.Snapshot)
			if tc.repaired {
				assert.NotEqual(t, oldVersion, dto.SnapshotVersion)
				assert.Equal(t, "/uploads/external-tweets/"+dto.ID+"/"+dto.SnapshotVersion+"/avatar.jpg", dto.Snapshot.Author.AvatarURL)
				assert.Equal(t, []string{"投票请在 X 查看"}, dto.Snapshot.Warnings)
			} else {
				assert.Equal(t, oldVersion, dto.SnapshotVersion)
				assert.Equal(t, tc.avatar, dto.Snapshot.Author.AvatarURL)
			}
		})
	}
}
