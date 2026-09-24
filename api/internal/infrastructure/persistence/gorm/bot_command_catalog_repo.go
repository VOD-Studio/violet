package gorm

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"gorm.io/gorm"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// BotCommandCatalogRepository 保存完整的 bot 命令目录。
type BotCommandCatalogRepository struct{ db *gorm.DB }

func NewBotCommandCatalogRepository(db *gorm.DB) *BotCommandCatalogRepository {
	return &BotCommandCatalogRepository{db: db}
}

func (r *BotCommandCatalogRepository) Replace(ctx context.Context, catalog domainchat.BotCommandCatalog) error {
	commands, err := json.Marshal(catalog.Commands)
	if err != nil {
		return err
	}
	return r.db.WithContext(ctx).Exec(`
		INSERT INTO chat_bot_command_catalogs (bot_id, schema_version, revision, commands, updated_at)
		VALUES (?, ?, ?, ?::jsonb, ?)
		ON CONFLICT (bot_id) DO UPDATE SET
			schema_version = EXCLUDED.schema_version,
			revision = EXCLUDED.revision,
			commands = EXCLUDED.commands,
			updated_at = EXCLUDED.updated_at
		WHERE chat_bot_command_catalogs.revision <> EXCLUDED.revision`,
		catalog.BotID.UUID(), catalog.SchemaVersion, catalog.Revision, string(commands), catalog.UpdatedAt,
	).Error
}

func (r *BotCommandCatalogRepository) ListByBotIDs(ctx context.Context, botIDs []domainshared.ID) (map[domainshared.ID]domainchat.BotCommandCatalog, error) {
	result := make(map[domainshared.ID]domainchat.BotCommandCatalog)
	if len(botIDs) == 0 {
		return result, nil
	}
	ids := make([]uuid.UUID, 0, len(botIDs))
	for _, id := range botIDs {
		ids = append(ids, id.UUID())
	}
	var rows []model.ChatBotCommandCatalog
	if err := r.db.WithContext(ctx).Where("bot_id IN ?", ids).Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		var commands []domainchat.BotCommand
		if err := json.Unmarshal(row.Commands, &commands); err != nil {
			return nil, err
		}
		id := domainshared.IDFromUUID(row.BotID)
		result[id] = domainchat.BotCommandCatalog{
			BotID: id, SchemaVersion: row.SchemaVersion, Revision: row.Revision,
			Commands: commands, UpdatedAt: row.UpdatedAt,
		}
	}
	return result, nil
}
