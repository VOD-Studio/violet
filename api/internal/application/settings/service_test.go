package settings

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	infraeventbus "blog-api/internal/infrastructure/eventbus"

	domainsettings "blog-api/internal/domain/settings"
)

// mockSettingsStore 手写 SettingsStore 桩（application/mocks 包未提供该接口）。
type mockSettingsStore struct{ mock.Mock }

func (m *mockSettingsStore) GetAll(ctx context.Context) (map[string]string, error) {
	args := m.Called(ctx)
	if v := args.Get(0); v != nil {
		return v.(map[string]string), args.Error(1)
	}
	return nil, args.Error(1)
}

func (m *mockSettingsStore) Upsert(ctx context.Context, key, value string) error {
	return m.Called(ctx, key, value).Error(0)
}

func (m *mockSettingsStore) UpsertMany(ctx context.Context, kvs map[string]string) error {
	return m.Called(ctx, kvs).Error(0)
}

func newSvc() (*Service, *mockSettingsStore) {
	store := new(mockSettingsStore)
	return NewService(store, infraeventbus.NewInMemory()), store
}

// GetPublic 必须返回公开配置 map，且过滤 github_token 等敏感字段。
func TestService_GetPublic(t *testing.T) {
	svc, store := newSvc()
	store.On("GetAll", mock.Anything).Return(map[string]string{
		"site_name":        "Violet",
		"github_username":  "sun",
		"github_token":     "super-secret",
		"tech_stack":       "Go,React",
		"comments_enabled": "true",
	}, nil).Once()

	pub, err := svc.GetPublic(context.Background())
	assert.NoError(t, err)
	// 安全字段正确映射到公开 DTO
	assert.Equal(t, "Violet", pub["site_name"])
	assert.Equal(t, "sun", pub["github_username"])
	assert.Equal(t, "Go,React", pub["tech_stack"])
	assert.Equal(t, true, pub["comments_enabled"])
	// 敏感字段被过滤：公开配置不得包含 github_token
	_, hasToken := pub["github_token"]
	assert.False(t, hasToken, "github_token 不应出现在公开配置")
	store.AssertExpectations(t)
}

func TestService_GetPublic_StoreError(t *testing.T) {
	svc, store := newSvc()
	store.On("GetAll", mock.Anything).Return(nil, assert.AnError).Once()

	pub, err := svc.GetPublic(context.Background())
	assert.Error(t, err)
	assert.Nil(t, pub)
	store.AssertExpectations(t)
}

// GetAll 把 key-value map 还原成聚合读模型（覆盖类型解析）。
func TestService_GetAll(t *testing.T) {
	svc, store := newSvc()
	store.On("GetAll", mock.Anything).Return(map[string]string{
		"site_name":        "Violet",
		"posts_per_page":   "20",
		"comments_enabled": "false",
	}, nil).Once()

	got, err := svc.GetAll(context.Background())
	assert.NoError(t, err)
	assert.Equal(t, "Violet", got.SiteName)
	assert.Equal(t, 20, got.PostsPerPage) // parseInt 覆盖默认值
	assert.False(t, got.CommentsEnabled)
	store.AssertExpectations(t)
}

func TestService_GetAll_Defaults(t *testing.T) {
	svc, store := newSvc()
	store.On("GetAll", mock.Anything).Return(map[string]string{}, nil).Once()

	got, err := svc.GetAll(context.Background())
	assert.NoError(t, err)
	assert.Equal(t, 10, got.PostsPerPage)  // 默认 10
	assert.True(t, got.GithubLoginEnabled) // parseBoolDefaultTrue
	store.AssertExpectations(t)
}

// Update 部分更新：只把非 nil 字段写入 store，再回读聚合。
func TestService_Update(t *testing.T) {
	svc, store := newSvc()
	name := "New Name"
	store.On("UpsertMany", mock.Anything, map[string]string{"site_name": "New Name"}).Return(nil).Once()
	store.On("GetAll", mock.Anything).Return(map[string]string{"site_name": "New Name"}, nil).Once()

	got, err := svc.Update(context.Background(), domainsettings.UpdateInput{SiteName: &name})
	assert.NoError(t, err)
	assert.Equal(t, "New Name", got.SiteName)
	store.AssertExpectations(t)
}

func TestService_Update_PropagatesStoreError(t *testing.T) {
	svc, store := newSvc()
	name := "Boom"
	store.On("UpsertMany", mock.Anything, map[string]string{"site_name": "Boom"}).Return(assert.AnError).Once()

	_, err := svc.Update(context.Background(), domainsettings.UpdateInput{SiteName: &name})
	assert.Error(t, err)
	store.AssertExpectations(t)
}
func TestService_Update_RejectsNegativeCustomEmojiQuota(t *testing.T) {
	svc, store := newSvc()
	quota := -1

	_, err := svc.Update(context.Background(), domainsettings.UpdateInput{CustomEmojiMaxPerUser: &quota})

	assert.Error(t, err)
	store.AssertNotCalled(t, "UpsertMany", mock.Anything, mock.Anything)
}
