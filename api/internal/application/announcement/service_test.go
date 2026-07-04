package announcement

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	domain "blog-api/internal/domain/announcement"
	"blog-api/internal/application/mocks"
)

func newServiceWithMock() (*Service, *mocks.MockAnnouncementRepository) {
	repo := new(mocks.MockAnnouncementRepository)
	return NewService(repo), repo
}

func TestService_Create(t *testing.T) {
	svc, repo := newServiceWithMock()
	repo.On("Save", mock.Anything, mock.AnythingOfType("*announcement.Announcement")).Return(42, nil).Once()

	id, err := svc.Create(context.Background(), CreateInput{
		Title: "标题", Content: "内容", Type: "warning",
		Display: "banner", Affects: []string{"comments"},
	})
	assert.NoError(t, err)
	assert.Equal(t, int32(42), id)
	repo.AssertExpectations(t)
}

func TestService_Create_InvalidSeverity(t *testing.T) {
	svc, _ := newServiceWithMock()
	_, err := svc.Create(context.Background(), CreateInput{
		Title: "t", Content: "c", Type: "critical",
	})
	assert.Error(t, err)
}

func TestService_Create_InvalidDisplay(t *testing.T) {
	svc, _ := newServiceWithMock()
	_, err := svc.Create(context.Background(), CreateInput{
		Title: "t", Content: "c", Type: "info", Display: "modal",
	})
	assert.Error(t, err)
}

func TestService_Get_NotFound(t *testing.T) {
	svc, repo := newServiceWithMock()
	repo.On("FindByID", mock.Anything, int32(99)).Return(nil, domain.ErrNotFound).Once()

	_, err := svc.Get(context.Background(), 99)
	assert.ErrorIs(t, err, domain.ErrNotFound)
	repo.AssertExpectations(t)
}

func TestService_Get_DTOFields(t *testing.T) {
	svc, repo := newServiceWithMock()
	a, _ := domain.NewAnnouncement(7, "标题", "内容", "error")
	_ = a.SetDisplay("article")
	a.SetAffects([]string{"auth", "media"})
	a.SetRichContent("# md", "<p>html</p>", "https://img", "摘要")

	repo.On("FindByID", mock.Anything, int32(7)).Return(a, nil).Once()

	dto, err := svc.Get(context.Background(), 7)
	assert.NoError(t, err)
	assert.Equal(t, "error", dto.Severity)
	assert.Equal(t, "error", dto.Type) // 冗余字段同步
	assert.Equal(t, "article", dto.Display)
	assert.Equal(t, []string{"auth", "media"}, dto.Affects)
	assert.Equal(t, "# md", dto.ContentMD)
	assert.Equal(t, "摘要", dto.Excerpt)
	repo.AssertExpectations(t)
}

func TestService_Update(t *testing.T) {
	svc, repo := newServiceWithMock()
	existing, _ := domain.NewAnnouncement(1, "旧", "旧内容", "info")

	repo.On("FindByID", mock.Anything, int32(1)).Return(existing, nil).Once()
	repo.On("Save", mock.Anything, mock.AnythingOfType("*announcement.Announcement")).Return(1, nil).Once()

	active := true
	order := 5
	err := svc.Update(context.Background(), UpdateInput{
		ID: 1, Title: "新", Content: "新内容", Type: "warning",
		Display: "card", IsActive: &active, SortOrder: &order,
		Affects: []string{"posts"}, Excerpt: "摘要",
	})
	assert.NoError(t, err)
	assert.Equal(t, "warning", existing.Severity())
	assert.Equal(t, "card", existing.Display())
	assert.Equal(t, 5, existing.SortOrder())
	assert.Equal(t, []string{"posts"}, existing.Affects())
	repo.AssertExpectations(t)
}

func TestService_Delete(t *testing.T) {
	svc, repo := newServiceWithMock()
	repo.On("Delete", mock.Anything, int32(3)).Return(nil).Once()

	err := svc.Delete(context.Background(), 3)
	assert.NoError(t, err)
	repo.AssertExpectations(t)
}

func TestService_ListActive_Empty(t *testing.T) {
	svc, repo := newServiceWithMock()
	repo.On("FindActive", mock.Anything).Return([]*domain.Announcement{}, nil).Once()

	dtos, err := svc.ListActive(context.Background())
	assert.NoError(t, err)
	assert.Empty(t, dtos)
	repo.AssertExpectations(t)
}
