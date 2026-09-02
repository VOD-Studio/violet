package app

import (
	appnote "blog-api/internal/application/note"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	notehttp "blog-api/internal/interfaces/http/handler/note"

	"gorm.io/gorm"
)

type NoteContainer struct {
	Handler *notehttp.Handler
	Service *appnote.Service
}

func NewNoteContainer(db *gorm.DB) *NoteContainer {
	service := appnote.NewService(gormrepo.NewNoteRepository(db))
	return &NoteContainer{Handler: notehttp.NewHandler(service), Service: service}
}
