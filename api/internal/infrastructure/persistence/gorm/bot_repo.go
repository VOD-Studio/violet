package gorm

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// BotRepository 聊天 bot 凭证的 GORM 仓储实现。
type BotRepository struct {
	db *gorm.DB
}

// NewBotRepository 构造 bot 仓储。
func NewBotRepository(db *gorm.DB) *BotRepository { return &BotRepository{db: db} }

// FindByID 按 bot ID 查找。
func (r *BotRepository) FindByID(ctx context.Context, id domainshared.ID) (*domainchat.Bot, error) {
	var po model.ChatBot
	err := r.db.WithContext(ctx).Where("id = ?", id.UUID()).Take(&po).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, domainchat.ErrBotNotFound
	}
	if err != nil {
		return nil, err
	}
	return botToDomain(po), nil
}

// FindByUserID 按虚拟用户 ID 反查 bot。
func (r *BotRepository) FindByUserID(ctx context.Context, userID domainshared.ID) (*domainchat.Bot, error) {
	var po model.ChatBot
	err := r.db.WithContext(ctx).Where("user_id = ?", userID.UUID()).Take(&po).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, domainchat.ErrBotNotFound
	}
	if err != nil {
		return nil, err
	}
	return botToDomain(po), nil
}

// FindByToken 按 token 哈希查找（鉴权路径）。
func (r *BotRepository) FindByToken(ctx context.Context, tokenHash string) (*domainchat.Bot, error) {
	var po model.ChatBot
	err := r.db.WithContext(ctx).Where("token_hash = ?", tokenHash).Take(&po).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, domainchat.ErrBotNotFound
	}
	if err != nil {
		return nil, err
	}
	return botToDomain(po), nil
}

// ListByUserIDs 批量反查虚拟用户 ID 对应的 bot，非 bot 成员自然缺席。
func (r *BotRepository) ListByUserIDs(ctx context.Context, userIDs []domainshared.ID) ([]*domainchat.Bot, error) {
	if len(userIDs) == 0 {
		return nil, nil
	}
	poUUIDs := make([]uuid.UUID, 0, len(userIDs))
	for _, id := range userIDs {
		poUUIDs = append(poUUIDs, id.UUID())
	}
	var rows []model.ChatBot
	if err := r.db.WithContext(ctx).Where("user_id IN ?", poUUIDs).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domainchat.Bot, 0, len(rows))
	for _, row := range rows {
		out = append(out, botToDomain(row))
	}
	return out, nil
}

// ListPage 分页列出 bot，按创建时间倒序（id 作同刻排序的 tiebreaker）。
func (r *BotRepository) ListPage(ctx context.Context, q domainshared.PageQuery) (domainshared.PageResult[*domainchat.Bot], error) {
	q = q.Normalize()
	query := r.db.WithContext(ctx).Model(&model.ChatBot{}).Order("created_at DESC, id ASC")
	var rows []model.ChatBot
	total, err := countAndFind(query, q, &rows, "聊天 Bot")
	if err != nil {
		return domainshared.PageResult[*domainchat.Bot]{}, err
	}
	out := make([]*domainchat.Bot, 0, len(rows))
	for _, row := range rows {
		out = append(out, botToDomain(row))
	}
	return domainshared.NewPageResult(q, out, total), nil
}

// Save 以 id 为冲突键整行 upsert。
//
// 显式列出更新列而非 OnConflict DoNothing/UpdateAll：token_hash 只应由
// RegenerateToken 走整行保存来改，写路径集中在一处便于审计。
func (r *BotRepository) Save(ctx context.Context, bot *domainchat.Bot) error {
	po := botToPO(bot)
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"user_id", "name", "avatar_id", "token_hash", "enabled", "updated_at",
		}),
	}).Create(po).Error
}

// Delete 删除 bot 记录；关联虚拟用户由调用方处理。
func (r *BotRepository) Delete(ctx context.Context, id domainshared.ID) error {
	result := r.db.WithContext(ctx).Where("id = ?", id.UUID()).Delete(&model.ChatBot{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return domainchat.ErrBotNotFound
	}
	return nil
}

func botToPO(b *domainchat.Bot) *model.ChatBot {
	po := &model.ChatBot{
		ID:        b.ID().UUID(),
		UserID:    b.UserID().UUID(),
		Name:      b.Name(),
		TokenHash: b.TokenHash(),
		Enabled:   b.IsEnabled(),
		CreatedAt: b.CreatedAt,
		UpdatedAt: b.UpdatedAt,
	}
	if b.AvatarID() != nil {
		avatar := b.AvatarID().UUID()
		po.AvatarID = &avatar
	}
	return po
}

func botToDomain(po model.ChatBot) *domainchat.Bot {
	var avatarID *domainshared.ID
	if po.AvatarID != nil {
		id := domainshared.IDFromUUID(*po.AvatarID)
		avatarID = &id
	}
	return domainchat.ReconstructBot(
		domainshared.IDFromUUID(po.ID), domainshared.IDFromUUID(po.UserID),
		po.Name, avatarID, po.TokenHash, po.Enabled, po.CreatedAt, po.UpdatedAt,
	)
}

// 编译期断言：BotRepository 实现领域端口
var _ domainchat.BotRepository = (*BotRepository)(nil)
