package gorm

import (
	"context"

	appnote "blog-api/internal/application/note"
	apppost "blog-api/internal/application/post"
	domainnote "blog-api/internal/domain/note"
	domainpost "blog-api/internal/domain/post"
	domainpublication "blog-api/internal/domain/publication"

	"gorm.io/gorm"
)

// PostPublicationUnitOfWork 在同一事务中提供文章与发布物仓储。
type PostPublicationUnitOfWork struct{ db *gorm.DB }

// NewPostPublicationUnitOfWork 绑定数据库句柄；Do 回调中的文章与投影仓储共享事务。
func NewPostPublicationUnitOfWork(db *gorm.DB) *PostPublicationUnitOfWork {
	return &PostPublicationUnitOfWork{db: db}
}

// Do 在同一 PostgreSQL 事务内执行文章与发布物写入。
func (u *PostPublicationUnitOfWork) Do(ctx context.Context, fn func(apppost.PublicationTransaction) error) error {
	return u.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return fn(&postPublicationTransaction{posts: NewPostRepository(tx), publications: NewPublicationRepository(tx)})
	})
}

type postPublicationTransaction struct {
	posts        domainpost.PostRepository
	publications domainpublication.Writer
}

func (t *postPublicationTransaction) Posts() domainpost.PostRepository       { return t.posts }
func (t *postPublicationTransaction) Publications() domainpublication.Writer { return t.publications }

// NotePublicationUnitOfWork 在同一事务中提供笔记与发布物仓储。
type NotePublicationUnitOfWork struct{ db *gorm.DB }

// NewNotePublicationUnitOfWork 绑定数据库句柄；Do 回调中的笔记与投影仓储共享事务。
func NewNotePublicationUnitOfWork(db *gorm.DB) *NotePublicationUnitOfWork {
	return &NotePublicationUnitOfWork{db: db}
}

// Do 在同一 PostgreSQL 事务内执行笔记与发布物写入。
func (u *NotePublicationUnitOfWork) Do(ctx context.Context, fn func(appnote.PublicationTransaction) error) error {
	return u.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return fn(&notePublicationTransaction{notes: NewNoteRepository(tx), publications: NewPublicationRepository(tx)})
	})
}

type notePublicationTransaction struct {
	notes        domainnote.Repository
	publications domainpublication.Writer
}

func (t *notePublicationTransaction) Notes() domainnote.Repository           { return t.notes }
func (t *notePublicationTransaction) Publications() domainpublication.Writer { return t.publications }

var _ apppost.PublicationUnitOfWork = (*PostPublicationUnitOfWork)(nil)
var _ appnote.PublicationUnitOfWork = (*NotePublicationUnitOfWork)(nil)
