package tag

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	domaintag "blog-api/internal/domain/tag"
)

// mockTagRepo 手写 TagRepository 桩（application/mocks 包未提供该接口）。
type mockTagRepo struct{ mock.Mock }

func (m *mockTagRepo) FindAll(ctx context.Context) ([]domaintag.Tag, error) {
	args := m.Called(ctx)
	if v := args.Get(0); v != nil {
		return v.([]domaintag.Tag), args.Error(1)
	}
	return nil, args.Error(1)
}

func (m *mockTagRepo) FindByID(ctx context.Context, id int32) (domaintag.Tag, error) {
	args := m.Called(ctx, id)
	if v := args.Get(0); v != nil {
		return v.(domaintag.Tag), args.Error(1)
	}
	return domaintag.Tag{}, args.Error(1)
}

func (m *mockTagRepo) FindBySlug(ctx context.Context, slug string) (domaintag.Tag, error) {
	args := m.Called(ctx, slug)
	if v := args.Get(0); v != nil {
		return v.(domaintag.Tag), args.Error(1)
	}
	return domaintag.Tag{}, args.Error(1)
}

func (m *mockTagRepo) Save(ctx context.Context, t domaintag.Tag) (int32, error) {
	args := m.Called(ctx, t)
	return args.Get(0).(int32), args.Error(1)
}

func (m *mockTagRepo) Delete(ctx context.Context, id int32) error {
	return m.Called(ctx, id).Error(0)
}

func (m *mockTagRepo) ExistsBySlug(ctx context.Context, slug string) (bool, error) {
	args := m.Called(ctx, slug)
	return args.Bool(0), args.Error(1)
}

func newSvc() (*Service, *mockTagRepo) {
	repo := new(mockTagRepo)
	return NewService(repo), repo
}

// List 把领域 Tag 映射成 DTO。
func TestService_List(t *testing.T) {
	svc, repo := newSvc()
	repo.On("FindAll", mock.Anything).Return([]domaintag.Tag{
		domaintag.NewTag(1, "Go", "go"),
		domaintag.NewTag(2, "React", "react"),
	}, nil).Once()

	dtos, err := svc.List(context.Background())
	assert.NoError(t, err)
	assert.Len(t, dtos, 2)
	assert.Equal(t, TagDTO{ID: 1, Name: "Go", Slug: "go"}, dtos[0])
	assert.Equal(t, TagDTO{ID: 2, Name: "React", Slug: "react"}, dtos[1])
	repo.AssertExpectations(t)
}

func TestService_List_Empty(t *testing.T) {
	svc, repo := newSvc()
	repo.On("FindAll", mock.Anything).Return([]domaintag.Tag{}, nil).Once()

	dtos, err := svc.List(context.Background())
	assert.NoError(t, err)
	assert.Empty(t, dtos)
	repo.AssertExpectations(t)
}

func TestService_List_StoreError(t *testing.T) {
	svc, repo := newSvc()
	repo.On("FindAll", mock.Anything).Return(nil, assert.AnError).Once()

	dtos, err := svc.List(context.Background())
	assert.Error(t, err)
	assert.Nil(t, dtos)
	repo.AssertExpectations(t)
}

// Create 自动生成 slug，校验冲突后落库。
func TestService_Create(t *testing.T) {
	svc, repo := newSvc()
	repo.On("ExistsBySlug", mock.Anything, "go").Return(false, nil).Once()
	repo.On("Save", mock.Anything, domaintag.NewTag(0, "Go", "go")).Return(int32(7), nil).Once()

	got, err := svc.Create(context.Background(), "Go")
	assert.NoError(t, err)
	assert.Equal(t, TagDTO{ID: 7, Name: "Go", Slug: "go"}, got)
	repo.AssertExpectations(t)
}

// slug 已存在 → 返回领域冲突错误。
func TestService_Create_ConflictSlug(t *testing.T) {
	svc, repo := newSvc()
	repo.On("ExistsBySlug", mock.Anything, "go").Return(true, nil).Once()

	_, err := svc.Create(context.Background(), "Go")
	assert.ErrorIs(t, err, domaintag.ErrNameExists)
	repo.AssertExpectations(t)
}

// CreateOrGet 新建：slug 不存在则落库返回新标签。
func TestService_CreateOrGet_Create(t *testing.T) {
	svc, repo := newSvc()
	repo.On("FindBySlug", mock.Anything, "go").Return(domaintag.Tag{}, domaintag.ErrNotFound).Once()
	repo.On("Save", mock.Anything, domaintag.NewTag(0, "Go", "go")).Return(int32(7), nil).Once()

	got, err := svc.CreateOrGet(context.Background(), "Go")
	assert.NoError(t, err)
	assert.Equal(t, TagDTO{ID: 7, Name: "Go", Slug: "go"}, got)
	repo.AssertExpectations(t)
}

// CreateOrGet 幂等：slug 已存在则返回已存在标签，不调 Save。
func TestService_CreateOrGet_Existing(t *testing.T) {
	svc, repo := newSvc()
	existing := domaintag.NewTag(3, "Go", "go")
	repo.On("FindBySlug", mock.Anything, "go").Return(existing, nil).Once()

	got, err := svc.CreateOrGet(context.Background(), "Go")
	assert.NoError(t, err)
	assert.Equal(t, TagDTO{ID: 3, Name: "Go", Slug: "go"}, got)
	repo.AssertExpectations(t)
}

// CreateOrGet 存储错误透传（FindBySlug 返回非 NotFound 错误）。
func TestService_CreateOrGet_StoreError(t *testing.T) {
	svc, repo := newSvc()
	repo.On("FindBySlug", mock.Anything, "go").Return(domaintag.Tag{}, assert.AnError).Once()

	_, err := svc.CreateOrGet(context.Background(), "Go")
	assert.Error(t, err)
	repo.AssertExpectations(t)
}

// Update 时 slug 未变，不触发冲突检查。
func TestService_Update_SlugUnchanged(t *testing.T) {
	svc, repo := newSvc()
	repo.On("FindByID", mock.Anything, int32(1)).Return(domaintag.NewTag(1, "Go", "go"), nil).Once()
	repo.On("Save", mock.Anything, domaintag.NewTag(1, "Go", "go")).Return(int32(1), nil).Once()

	got, err := svc.Update(context.Background(), UpdateInput{ID: 1, Name: "Go"})
	assert.NoError(t, err)
	assert.Equal(t, TagDTO{ID: 1, Name: "Go", Slug: "go"}, got)
	repo.AssertExpectations(t)
}

// Update 时 slug 变化且已被占用 → 追加短 uuid 去重。
func TestService_Update_SlugConflictAppendsUUID(t *testing.T) {
	svc, repo := newSvc()
	repo.On("FindByID", mock.Anything, int32(1)).Return(domaintag.NewTag(1, "Go", "go"), nil).Once()
	repo.On("ExistsBySlug", mock.Anything, "react").Return(true, nil).Once()
	repo.On("Save", mock.Anything, mock.AnythingOfType("tag.Tag")).Return(int32(1), nil).Once()

	got, err := svc.Update(context.Background(), UpdateInput{ID: 1, Name: "React"})
	assert.NoError(t, err)
	assert.Equal(t, int32(1), got.ID)
	assert.Equal(t, "React", got.Name)
	assert.True(t, strings.HasPrefix(got.Slug, "react-"), "冲突 slug 应追加短 uuid，got=%s", got.Slug)
	repo.AssertExpectations(t)
}

func TestService_Delete(t *testing.T) {
	svc, repo := newSvc()
	repo.On("Delete", mock.Anything, int32(3)).Return(nil).Once()

	err := svc.Delete(context.Background(), 3)
	assert.NoError(t, err)
	repo.AssertExpectations(t)
}
