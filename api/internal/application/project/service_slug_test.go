package project

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	domain "blog-api/internal/domain/project"
	"blog-api/internal/domain/shared"
)

func TestCreateGeneratedSlugResolvesExistingSuffixes(t *testing.T) {
	svc, repo := newSvc()
	existing, err := domain.NewProject(shared.NewID(), "Violet", "")
	require.NoError(t, err)
	for _, slug := range []string{"violet", "violet-2"} {
		repo.On("FindBySlug", mock.Anything, slug).Return(existing, nil).Once()
	}
	repo.On("FindBySlug", mock.Anything, "violet-3").Return(nil, domain.ErrNotFound).Once()
	repo.On("Save", mock.Anything, mock.MatchedBy(func(p *domain.Project) bool {
		return p.Slug() == "violet-3"
	})).Return(nil).Once()
	require.NoError(t, svc.Create(context.Background(), CreateInput{Title: "Violet"}))
	repo.AssertExpectations(t)
}

func TestCreateCustomSlug(t *testing.T) {
	for _, tc := range []struct {
		name, slug string
		conflict   bool
		wantCode   shared.ErrorCode
	}{
		{name: "custom slug", slug: "custom-project"},
		{name: "invalid format", slug: "Bad Slug", wantCode: shared.CodeBadRequest},
		{name: "existing slug", slug: "taken", conflict: true, wantCode: shared.CodeConflict},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc, repo := newSvc()
			if domain.IsValidSlug(tc.slug) {
				if tc.conflict {
					existing, err := domain.NewProject(shared.NewID(), "Existing", "")
					require.NoError(t, err)
					repo.On("FindBySlug", mock.Anything, tc.slug).Return(existing, nil).Once()
				} else {
					repo.On("FindBySlug", mock.Anything, tc.slug).Return(nil, domain.ErrNotFound).Once()
					repo.On("Save", mock.Anything, mock.MatchedBy(func(p *domain.Project) bool {
						return p.Slug() == tc.slug
					})).Return(nil).Once()
				}
			}
			err := svc.Create(context.Background(), CreateInput{Title: "Project", Slug: tc.slug})
			if tc.wantCode == "" {
				require.NoError(t, err)
			} else {
				var domainErr *shared.DomainError
				require.ErrorAs(t, err, &domainErr)
				assert.Equal(t, tc.wantCode, domainErr.Code)
				repo.AssertNotCalled(t, "Save", mock.Anything, mock.Anything)
			}
			repo.AssertExpectations(t)
		})
	}
}

func TestCreateNonASCIITitleUsesStableID(t *testing.T) {
	for _, title := range []string{"我的项目", "✨"} {
		t.Run(title, func(t *testing.T) {
			svc, repo := newSvc()
			repo.On("FindBySlug", mock.Anything, mock.Anything).Return(nil, domain.ErrNotFound).Once()
			repo.On("Save", mock.Anything, mock.MatchedBy(func(p *domain.Project) bool {
				return p.Slug() == "project-"+p.ID().String()
			})).Return(nil).Once()
			require.NoError(t, svc.Create(context.Background(), CreateInput{Title: title}))
			repo.AssertExpectations(t)
		})
	}
}

func TestUpdateSlug(t *testing.T) {
	for _, tc := range []struct {
		name     string
		slug     *string
		conflict bool
		wantErr  bool
	}{
		{name: "omitted slug remains stable"},
		{name: "same slug is allowed", slug: ptr("violet")},
		{name: "slug can be changed", slug: ptr("new-violet")},
		{name: "empty is invalid", slug: ptr(""), wantErr: true},
		{name: "invalid format", slug: ptr("Bad Slug"), wantErr: true},
		{name: "collision", slug: ptr("taken"), conflict: true, wantErr: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc, repo := newSvc()
			p, err := domain.NewProject(shared.NewID(), "Violet", "original")
			require.NoError(t, err)
			repo.On("FindByID", mock.Anything, p.ID()).Return(p, nil).Once()
			if tc.slug != nil && *tc.slug != p.Slug() && domain.IsValidSlug(*tc.slug) {
				if tc.conflict {
					other, err := domain.NewProject(shared.NewID(), "Other", "")
					require.NoError(t, err)
					repo.On("FindBySlug", mock.Anything, *tc.slug).Return(other, nil).Once()
				} else {
					repo.On("FindBySlug", mock.Anything, *tc.slug).Return(nil, domain.ErrNotFound).Once()
				}
			}
			if !tc.wantErr {
				repo.On("Save", mock.Anything, p).Return(nil).Once()
			}
			err = svc.Update(context.Background(), p.ID().String(), UpdateInput{Title: "Renamed", Slug: tc.slug})
			if tc.wantErr {
				require.Error(t, err)
				assert.Equal(t, "Violet", p.Title())
				assert.Equal(t, "violet", p.Slug())
				repo.AssertNotCalled(t, "Save", mock.Anything, mock.Anything)
			} else {
				require.NoError(t, err)
				want := "violet"
				if tc.slug != nil {
					want = *tc.slug
				}
				assert.Equal(t, want, p.Slug())
			}
			repo.AssertExpectations(t)
		})
	}
}

func TestGetBySlug(t *testing.T) {
	svc, repo := newSvc()
	p, err := domain.NewProject(shared.NewID(), "Violet", "")
	require.NoError(t, err)
	repo.On("FindBySlug", mock.Anything, "violet").Return(p, nil).Once()
	dto, err := svc.GetBySlug(context.Background(), "violet")
	require.NoError(t, err)
	assert.Equal(t, p.ID().String(), dto.ID)
	assert.Equal(t, "violet", dto.Slug)
	_, err = svc.GetBySlug(context.Background(), "Bad Slug")
	assert.ErrorIs(t, err, domain.ErrNotFound)
	repo.AssertExpectations(t)
}

func ptr(s string) *string { return &s }
