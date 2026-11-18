package app

import (
	"gorm.io/gorm"

	appjournal "blog-api/internal/application/journal"
	appnote "blog-api/internal/application/note"
	appactivity "blog-api/internal/application/repositoryactivity"
	infragithub "blog-api/internal/infrastructure/github"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	journalhttp "blog-api/internal/interfaces/http/handler/journal"
)

type JournalContainer struct {
	Handler  *journalhttp.Handler
	Activity *appactivity.Service
}

func NewJournalContainer(db *gorm.DB, notes *appnote.Service) *JournalContainer {
	activity := appactivity.NewService(
		gormrepo.NewProjectRepository(db),
		infragithub.NewActivityAdapter(),
		gormrepo.NewRepositoryActivityRepository(db),
	)
	return &JournalContainer{
		Activity: activity,
		Handler:  journalhttp.NewHandler(appjournal.NewService(notes, activity)),
	}
}
