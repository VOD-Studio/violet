package gorm

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainpersona "blog-api/internal/domain/persona"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func TestPersonaRepositoryIntegration_FindPageCountsJoinedSelection(t *testing.T) {
	db := setupIntegrationDB(t)
	authorID := preseedAuthor(t, db)
	personaID := domainshared.NewID()
	name := "persona-count-" + personaID.String()
	now := time.Now().UTC()
	require.NoError(t, db.Create(&model.Persona{
		ID: personaID.UUID(), CreatedBy: authorID.UUID(), Name: name,
		Version: 1, CreatedAt: now, UpdatedAt: now,
	}).Error)
	t.Cleanup(func() {
		_ = db.Exec("DELETE FROM persona_selection WHERE persona_id = ?", personaID.UUID()).Error
		_ = db.Exec("DELETE FROM personas WHERE id = ?", personaID.UUID()).Error
		_ = db.Exec("DELETE FROM users WHERE id = ?", authorID.UUID()).Error
	})

	page, err := NewPersonaRepository(db).FindPage(
		context.Background(),
		domainpersona.ListFilter{Search: name},
		domainshared.PageQuery{Page: 1, Limit: 20},
	)
	require.NoError(t, err)
	assert.Equal(t, int64(1), page.Total)
	require.Len(t, page.Items, 1)
	assert.Equal(t, personaID, page.Items[0].ID())
}
