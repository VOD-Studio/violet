package customemoji

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/shared"
)

func TestNewCustomEmoji_Valid(t *testing.T) {
	ownerID := shared.NewID()
	now := time.Now()

	e, err := NewCustomEmoji(ownerID, "mycat", "/uploads/emoji/a.png", now)

	require.NoError(t, err)
	assert.False(t, e.ID().IsZero())
	assert.True(t, e.OwnerID().Equal(ownerID))
	assert.Equal(t, "mycat", e.Name())
	assert.Equal(t, "/uploads/emoji/a.png", e.URL())
	assert.Equal(t, now, e.CreatedAt())
	assert.True(t, e.IsUsable())
	assert.Nil(t, e.DeletedAt())
}

func TestNewCustomEmoji_NameTrimmed(t *testing.T) {
	e, err := NewCustomEmoji(shared.NewID(), "  mycat  ", "/uploads/emoji/a.png", time.Now())

	require.NoError(t, err)
	assert.Equal(t, "mycat", e.Name())
}

func TestNewCustomEmoji_EmptyName_Rejected(t *testing.T) {
	cases := []string{"", "   ", "\t\n"}
	for _, name := range cases {
		_, err := NewCustomEmoji(shared.NewID(), name, "/uploads/emoji/a.png", time.Now())
		require.ErrorIs(t, err, ErrEmptyName)
	}
}

func TestCustomEmoji_Delete_MarksUnusable(t *testing.T) {
	e, err := NewCustomEmoji(shared.NewID(), "mycat", "/uploads/emoji/a.png", time.Now())
	require.NoError(t, err)

	now := time.Now()
	e.Delete(now)

	assert.False(t, e.IsUsable())
	require.NotNil(t, e.DeletedAt())
	assert.Equal(t, now, *e.DeletedAt())
}

func TestReconstructCustomEmoji(t *testing.T) {
	id := shared.NewID()
	ownerID := shared.NewID()
	createdAt := time.Now().Add(-time.Hour)
	deletedAt := time.Now()

	e := ReconstructCustomEmoji(id, ownerID, "mycat", "/uploads/emoji/a.png", createdAt, &deletedAt)

	assert.True(t, e.ID().Equal(id))
	assert.True(t, e.OwnerID().Equal(ownerID))
	assert.Equal(t, "mycat", e.Name())
	assert.Equal(t, createdAt, e.CreatedAt())
	assert.False(t, e.IsUsable())
}
