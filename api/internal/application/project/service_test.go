package project

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	domain "blog-api/internal/domain/project"
	"blog-api/internal/domain/shared"
)

// mockProjectRepo 手写 ProjectRepository 桩（application/mocks 包未提供该接口）。
type mockProjectRepo struct{ mock.Mock }

func (m *mockProjectRepo) FindByID(ctx context.Context, id shared.ID) (*domain.Project, error) {
	args := m.Called(ctx, id)
	if v := args.Get(0); v != nil {
		return v.(*domain.Project), args.Error(1)
	}
	return nil, args.Error(1)
}

func (m *mockProjectRepo) FindAll(ctx context.Context) ([]*domain.Project, error) {
	args := m.Called(ctx)
	if v := args.Get(0); v != nil {
		return v.([]*domain.Project), args.Error(1)
	}
	return nil, args.Error(1)
}

func (m *mockProjectRepo) FindPage(ctx context.Context, q shared.PageQuery) (shared.PageResult[*domain.Project], error) {
	return shared.PageResult[*domain.Project]{}, nil
}

func (m *mockProjectRepo) Save(ctx context.Context, p *domain.Project) error {
	return m.Called(ctx, p).Error(0)
}

func (m *mockProjectRepo) Delete(ctx context.Context, id shared.ID) error {
	return m.Called(ctx, id).Error(0)
}

func newSvc() (*Service, *mockProjectRepo) {
	repo := new(mockProjectRepo)
	return NewService(repo), repo
}

const testUUID = "550e8400-e29b-41d4-a716-446655440000"

// List 把领域 Project 映射成 DTO。
func TestService_List(t *testing.T) {
	svc, repo := newSvc()
	id := shared.MustParseID(testUUID)
	now := time.Now()
	p := domain.ReconstructProject(id, "My Project", "desc", "https://x.com", "https://gh.com", "https://img.com", []string{"Go", "React"}, 2, now, now)
	repo.On("FindAll", mock.Anything).Return([]*domain.Project{p}, nil).Once()

	dtos, err := svc.List(context.Background())
	assert.NoError(t, err)
	assert.Len(t, dtos, 1)
	assert.Equal(t, id.String(), dtos[0].ID)
	assert.Equal(t, "My Project", dtos[0].Title)
	assert.Equal(t, "https://x.com", dtos[0].URL)
	assert.Equal(t, []string{"Go", "React"}, dtos[0].TechStack)
	assert.Equal(t, 2, dtos[0].SortOrder)
	repo.AssertExpectations(t)
}

func TestService_List_Empty(t *testing.T) {
	svc, repo := newSvc()
	repo.On("FindAll", mock.Anything).Return([]*domain.Project{}, nil).Once()

	dtos, err := svc.List(context.Background())
	assert.NoError(t, err)
	assert.Empty(t, dtos)
	repo.AssertExpectations(t)
}

func TestService_Get(t *testing.T) {
	svc, repo := newSvc()
	id := shared.MustParseID(testUUID)
	now := time.Now()
	p := domain.ReconstructProject(id, "My Project", "desc", "https://x.com", "", "", []string{"Go"}, 1, now, now)
	repo.On("FindByID", mock.Anything, id).Return(p, nil).Once()

	got, err := svc.Get(context.Background(), id.String())
	assert.NoError(t, err)
	assert.Equal(t, id.String(), got.ID)
	assert.Equal(t, "My Project", got.Title)
	assert.Equal(t, []string{"Go"}, got.TechStack)
	repo.AssertExpectations(t)
}

// 非法 ID 字符串在解析阶段即报错，不触达仓储。
func TestService_Get_InvalidID(t *testing.T) {
	svc, _ := newSvc()
	_, err := svc.Get(context.Background(), "not-a-uuid")
	assert.Error(t, err)
}

func TestService_Create(t *testing.T) {
	svc, repo := newSvc()
	repo.On("Save", mock.Anything, mock.AnythingOfType("*project.Project")).Return(nil).Once()

	err := svc.Create(context.Background(), CreateInput{
		Title: "New Project", Description: "d", URL: "https://x.com",
		TechStack: []string{"Go"}, SortOrder: 3,
	})
	assert.NoError(t, err)
	repo.AssertExpectations(t)
}

// 空标题违反领域不变量，Create 应直接报错且不落库。
func TestService_Create_EmptyTitle(t *testing.T) {
	svc, repo := newSvc()
	err := svc.Create(context.Background(), CreateInput{Title: ""})
	assert.Error(t, err)
	repo.AssertNotCalled(t, "Save")
}

func TestService_Update(t *testing.T) {
	svc, repo := newSvc()
	id := shared.MustParseID(testUUID)
	p := domain.ReconstructProject(id, "Old", "", "", "", "", nil, 0, time.Now(), time.Now())
	repo.On("FindByID", mock.Anything, id).Return(p, nil).Once()
	repo.On("Save", mock.Anything, mock.AnythingOfType("*project.Project")).Return(nil).Once()

	err := svc.Update(context.Background(), id.String(), UpdateInput{Title: "New", TechStack: []string{"Rust"}})
	assert.NoError(t, err)
	assert.Equal(t, "New", p.Title())
	assert.Equal(t, []string{"Rust"}, p.TechStack())
	repo.AssertExpectations(t)
}

func TestService_Delete(t *testing.T) {
	svc, repo := newSvc()
	id := shared.MustParseID(testUUID)
	repo.On("Delete", mock.Anything, id).Return(nil).Once()

	err := svc.Delete(context.Background(), id.String())
	assert.NoError(t, err)
	repo.AssertExpectations(t)
}

func TestService_Delete_InvalidID(t *testing.T) {
	svc, _ := newSvc()
	err := svc.Delete(context.Background(), "bad")
	assert.Error(t, err)
}
