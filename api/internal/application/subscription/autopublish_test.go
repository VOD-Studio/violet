package subscription

import (
	"context"
	"testing"

	apppost "blog-api/internal/application/post"
	domainpost "blog-api/internal/domain/post"
	domainpublication "blog-api/internal/domain/publication"
	"blog-api/internal/domain/shared"
	"blog-api/internal/middleware"

	"github.com/stretchr/testify/require"
)

type importedPostRepo struct {
	domainpost.PostRepository
	posts map[shared.ID]*domainpost.Post
}

func (r *importedPostRepo) ExistsBySlug(_ context.Context, slug string) (bool, error) {
	for _, p := range r.posts {
		if p.Slug() == slug {
			return true, nil
		}
	}
	return false, nil
}

func (r *importedPostRepo) Save(_ context.Context, p *domainpost.Post) error {
	r.posts[p.ID()] = p
	return nil
}

func (r *importedPostRepo) SaveVersion(context.Context, *domainpost.PostVersion) error {
	return nil
}

func (r *importedPostRepo) FindByID(_ context.Context, id shared.ID) (*domainpost.Post, error) {
	return r.posts[id], nil
}

type importedPublications struct {
	domainpublication.Writer
	entries map[shared.ID]domainpublication.Entry
}

func (w *importedPublications) Upsert(_ context.Context, entry domainpublication.Entry) error {
	w.entries[entry.SourceID] = entry
	return nil
}

type importPublicationUOW struct {
	repo         *importedPostRepo
	publications *importedPublications
}

func (u *importPublicationUOW) Do(ctx context.Context, fn func(apppost.PublicationTransaction) error) error {
	return fn(u)
}

func (u *importPublicationUOW) Posts() domainpost.PostRepository       { return u.repo }
func (u *importPublicationUOW) Publications() domainpublication.Writer { return u.publications }

type parsedPostImporter struct{ *apppost.Service }

func (p *parsedPostImporter) ImportURL(context.Context, string, apppost.ImportURLOpts) (apppost.ImportResult, error) {
	return apppost.ImportResult{Title: "导入文章", Markdown: "正文", HTML: "<p>正文</p>"}, nil
}

func TestFetchOne_AutoPublishAsSubscriptionOwner(t *testing.T) {
	for _, source := range []string{"scheduler", "another-admin"} {
		t.Run(source, func(t *testing.T) {
			svc, _, entries, _, parser, sub := setupFetchSvc(t)
			require.NoError(t, sub.UpdateConfig("源", "", true, "", nil))
			posts := &importedPostRepo{posts: make(map[shared.ID]*domainpost.Post)}
			publications := &importedPublications{entries: make(map[shared.ID]domainpublication.Entry)}
			uow := &importPublicationUOW{repo: posts, publications: publications}
			postService := apppost.NewService(posts, nil, nil, nil, &fakeBus{}, uow)
			svc.SetFetchDeps(entries, &parsedPostImporter{Service: postService}, parser)
			parser.items = []FeedItem{{GUID: "article", Link: "https://example.com/article"}}
			ctx := context.Background()
			if source == "another-admin" {
				ctx = context.WithValue(ctx, middleware.UserIDKey, shared.NewID().String())
			}

			report := svc.FetchOne(ctx, sub.ID().String())
			require.Zero(t, report.Failed)
			require.Equal(t, 1, report.Imported)
			entry, err := entries.FindBySubAndGUID(ctx, sub.ID(), "article")
			require.NoError(t, err)
			require.NotNil(t, entry.PostID())
			p := posts.posts[*entry.PostID()]
			require.Equal(t, sub.UserID(), p.AuthorID())
			require.Equal(t, domainpost.StatusPublished, p.Status())
			require.Equal(t, p.Slug(), publications.entries[p.ID()].RouteKey)

			report = svc.FetchOne(ctx, sub.ID().String())
			require.Equal(t, 1, report.Skipped)
			require.Len(t, posts.posts, 1)
		})
	}
}
