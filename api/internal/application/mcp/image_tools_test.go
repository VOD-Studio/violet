package mcp

import (
	"context"
	"encoding/base64"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appmedia "blog-api/internal/application/media"
	domainapitoken "blog-api/internal/domain/api_token"
	domainshared "blog-api/internal/domain/shared"
)

type fakeImageService struct {
	input *appmedia.SavePostImageInput
	err   error
}

func (f *fakeImageService) SavePostImage(_ context.Context, in appmedia.SavePostImageInput) (appmedia.BotMediaDTO, error) {
	f.input = &in
	return appmedia.BotMediaDTO{URL: "/uploads/post/x.png", Width: 1, Height: 1}, f.err
}

func TestUploadImage_DecodesAndDelegates(t *testing.T) {
	fake := &fakeImageService{}
	owner := domainshared.NewID()
	data := []byte("png-bytes")

	res, _, err := NewImageTools(fake).UploadImage(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsWrite}, owner.String()),
		uploadImageArgs{Filename: "a.png", DataBase64: base64.StdEncoding.EncodeToString(data)})
	require.NoError(t, err)
	assert.False(t, res.IsError)
	require.NotNil(t, fake.input)
	assert.Equal(t, data, fake.input.Data)
	assert.Equal(t, owner, fake.input.OwnerID)
	assert.Contains(t, resultText(t, res), "/uploads/post/x.png")
}

func TestUploadImage_RejectedWithoutWriteScope(t *testing.T) {
	fake := &fakeImageService{}
	res, _, err := NewImageTools(fake).UploadImage(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsRead}, domainshared.NewID().String()),
		uploadImageArgs{DataBase64: "AAAA"})
	require.NoError(t, err)
	assert.True(t, res.IsError)
	assert.Nil(t, fake.input)
}

func TestUploadImage_InvalidInputBecomesToolError(t *testing.T) {
	scopes := []string{domainapitoken.ScopePostsWrite}
	owner := domainshared.NewID().String()
	tooBig := base64.StdEncoding.EncodeToString(make([]byte, maxUploadImageBytes+1))

	for name, args := range map[string]uploadImageArgs{
		"非法 base64": {DataBase64: "***"},
		"超过上限":      {DataBase64: tooBig},
	} {
		fake := &fakeImageService{}
		res, _, err := NewImageTools(fake).UploadImage(context.Background(), reqWithToken(scopes, owner), args)
		require.NoError(t, err, name)
		assert.True(t, res.IsError, name)
		assert.Nil(t, fake.input, name)
	}
}

func TestUploadImage_ServiceErrorBecomesToolError(t *testing.T) {
	fake := &fakeImageService{err: errors.New("仅支持 png、jpeg、gif、webp 图片")}
	res, _, err := NewImageTools(fake).UploadImage(context.Background(),
		reqWithToken([]string{domainapitoken.ScopePostsWrite}, domainshared.NewID().String()),
		uploadImageArgs{DataBase64: "AAAA"})
	require.NoError(t, err)
	assert.True(t, res.IsError)
}
