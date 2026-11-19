package gorm

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/application/publicprofile"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func TestPublicProfileIntegration_StableMixedCursorAndPrivacy(t *testing.T) {
	db := setupIntegrationDB(t)
	owner := preseedAuthor(t, db)
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", owner.UUID()).Update("username", "profile_t13").Error)
	at := time.Now().UTC().Add(-time.Hour).Truncate(time.Microsecond)
	visiblePost := model.Post{ID: uuid.New(), AuthorID: owner.UUID(), Slug: "profile-public", Title: "Public article", Excerpt: "Public preview", Status: "published", PublishedAt: &at, CreatedAt: at, UpdatedAt: at}
	require.NoError(t, db.Create(&visiblePost).Error)
	draft := model.Post{ID: uuid.New(), AuthorID: owner.UUID(), Slug: "profile-draft", Title: "PRIVATE DRAFT", Status: "draft", PublishedAt: &at, CreatedAt: at, UpdatedAt: at}
	require.NoError(t, db.Create(&draft).Error)
	tweet := model.Tweet{ID: uuid.New(), AuthorID: owner.UUID(), Content: "Visible tweet", CreatedAt: at, UpdatedAt: at}
	require.NoError(t, db.Create(&tweet).Error)
	pictures := []byte(`[{"url":"/uploads/profile.png","width":640,"height":480,"size":4096}]`)
	comment := model.Comment{ID: uuid.New(), PostID: visiblePost.ID, CreatedBy: new(owner.UUID()), AuthorName: "profile_t13", AuthorEmail: "private@example.com", Body: "Public comment", Pictures: pictures, Status: "approved", CreatedAt: at, UpdatedAt: at}
	require.NoError(t, db.Create(&comment).Error)
	secondComment := comment
	secondComment.ID, secondComment.Pictures = uuid.New(), []byte("null")
	require.NoError(t, db.Create(&secondComment).Error)
	annotation := comment
	annotation.ID, annotation.Body = uuid.New(), "Public annotation"
	annotation.AnchorBlockID, annotation.AnchorSelectedText, annotation.AnchorBlockTextHash = new("block1"), new("Selected public text"), new("hash1")
	annotation.AnchorStartOffset, annotation.AnchorEndOffset = new(0), new(20)
	require.NoError(t, db.Create(&annotation).Error)
	pending := comment
	pending.ID, pending.Body, pending.Status = uuid.New(), "PRIVATE PENDING", "pending"
	require.NoError(t, db.Create(&pending).Error)
	onDraft := comment
	onDraft.ID, onDraft.PostID, onDraft.Body = uuid.New(), draft.ID, "PRIVATE DRAFT COMMENT"
	require.NoError(t, db.Create(&onDraft).Error)
	tweetComment := model.TweetComment{ID: uuid.New(), TweetID: tweet.ID, AuthorID: owner.UUID(), Body: "Public tweet reply", Pictures: pictures, CreatedAt: at, UpdatedAt: at}
	require.NoError(t, db.Create(&tweetComment).Error)
	require.NoError(t, db.Create(&model.TweetLike{TweetID: tweet.ID, UserID: owner.UUID(), CreatedAt: at}).Error)

	reader := NewPublicProfileReader(db)
	svc := publicprofile.NewService(NewUserRepository(db), reader)
	ctx := context.Background()
	profile, err := svc.Get(ctx, "profile_t13")
	require.NoError(t, err)
	assert.Equal(t, publicprofile.Stats{Posts: 1, Tweets: 1, Comments: 3, Annotations: 1, ReceivedLikes: 1}, profile.Stats)
	assert.Equal(t, int64(6), profile.Activity.Total)
	assert.Empty(t, profile.PublicReadingPreferences)

	var kinds []string
	var ids []string
	cursor := ""
	pictured := map[string]bool{comment.ID.String(): true, annotation.ID.String(): true, tweetComment.ID.String(): true}
	for {
		items, next, err := svc.List(ctx, "profile_t13", "all", cursor, 1)
		require.NoError(t, err)
		require.Len(t, items, 1)
		kinds = append(kinds, items[0].Type)
		ids = append(ids, items[0].ID)
		assert.NotContains(t, items[0].Body, "PRIVATE")
		if pictured[items[0].ID] {
			assert.Equal(t, []publicprofile.Image{{URL: "/uploads/profile.png", Width: new(640), Height: new(480)}}, items[0].Images)
		}
		if items[0].ID == secondComment.ID.String() {
			assert.Equal(t, []publicprofile.Image{}, items[0].Images)
		}
		if next == "" {
			break
		}
		cursor = next
	}
	assert.Equal(t, []string{"tweet_comment", "annotation", "comment", "comment", "tweet", "post"}, kinds)
	assert.Greater(t, ids[2], ids[3])
	for tab, want := range map[string]int{"posts": 1, "tweets": 1, "comments": 3, "annotations": 1} {
		items, _, err := svc.List(ctx, "profile_t13", tab, "", 20)
		require.NoError(t, err)
		assert.Len(t, items, want)
	}
	_, cursor, err = svc.List(ctx, "profile_t13", "all", "", 2)
	require.NoError(t, err)
	// A later moderation/deletion must take effect even for an already issued cursor.
	require.NoError(t, db.Model(&model.Comment{}).Where("created_by = ? AND anchor_block_id IS NULL", owner.UUID()).Update("status", "pending").Error)
	require.NoError(t, db.Delete(&tweet).Error)
	items, _, err := svc.List(ctx, "profile_t13", "all", cursor, 20)
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, "post", items[0].Type)
	// Soft-deleted accounts are 404, including direct activity URLs.
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", owner.UUID()).Update("deleted_at", time.Now()).Error)
	_, err = svc.Get(ctx, "profile_t13")
	require.Error(t, err)
	_, _, err = svc.List(ctx, "profile_t13", "all", cursor, 20)
	require.Error(t, err)
}

func TestPublicProfileIntegration_PreferenceRoundTrip(t *testing.T) {
	db := setupIntegrationDB(t)
	id := preseedAuthor(t, db)
	repo := NewUserRepository(db)
	u, err := repo.FindByID(context.Background(), id)
	require.NoError(t, err)
	preferences := []string{"Go", "Postgres"}
	require.NoError(t, u.UpdatePublicDetails(new("杭州"), new("https://example.com"), &preferences))
	require.NoError(t, repo.Save(context.Background(), u))
	loaded, err := repo.FindByID(context.Background(), id)
	require.NoError(t, err)
	assert.Equal(t, u.PublicDetails(), loaded.PublicDetails())
	empty := []string{}
	require.NoError(t, loaded.UpdatePublicDetails(nil, nil, &empty))
	require.NoError(t, repo.Save(context.Background(), loaded))
	loaded, err = repo.FindByID(context.Background(), id)
	require.NoError(t, err)
	assert.Empty(t, loaded.PublicDetails().ReadingPreferences)
	assert.Equal(t, "杭州", loaded.PublicDetails().Location)
}
