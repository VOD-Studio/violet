package gorm

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/crypto"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// BotRepository 聊天 bot 凭证的 GORM 仓储实现。
type BotRepository struct {
	db *gorm.DB
	// box 加解密明文凭据；nil 表示未配 BOT_TOKEN_KEY，凭据只能一次性展示。
	box *crypto.TokenBox
}

// NewBotRepository 构造 bot 仓储。box 传 nil 时密文列恒为空，不影响鉴权。
func NewBotRepository(db *gorm.DB, box *crypto.TokenBox) *BotRepository {
	return &BotRepository{db: db, box: box}
}

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
	return r.toDomain(po), nil
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
	return r.toDomain(po), nil
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
	return r.toDomain(po), nil
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
		out = append(out, r.toDomain(row))
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
		out = append(out, r.toDomain(row))
	}
	return domainshared.NewPageResult(q, out, total), nil
}

// Save 以 id 为冲突键整行 upsert。
//
// 显式列出更新列而非 OnConflict DoNothing/UpdateAll：token_hash 只应由
// RegenerateToken 走整行保存来改，写路径集中在一处便于审计。
func (r *BotRepository) Save(ctx context.Context, bot *domainchat.Bot) error {
	po, err := r.toPO(bot)
	if err != nil {
		return err
	}
	cols := []string{"user_id", "name", "avatar_id", "token_hash", "enabled", "updated_at"}
	// 只有手上拿着明文（新建或刚重置）才改写密文列：改名/启停同样走整行 upsert，
	// 把列无条件写进去会因聚合明文为空而覆盖成 NULL，凭据从此永久看不见。
	if po.TokenEncrypted != nil {
		cols = append(cols, "token_encrypted")
	}
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns(cols),
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

func (r *BotRepository) toPO(b *domainchat.Bot) (*model.ChatBot, error) {
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
	if b.Token() == "" || r.box == nil {
		return po, nil
	}
	sealed, err := r.box.Seal(b.Token())
	if err != nil {
		return nil, domainshared.Internal("加密 bot 凭据失败", err)
	}
	po.TokenEncrypted = &sealed
	return po, nil
}

func (r *BotRepository) toDomain(po model.ChatBot) *domainchat.Bot {
	var avatarID *domainshared.ID
	if po.AvatarID != nil {
		id := domainshared.IDFromUUID(*po.AvatarID)
		avatarID = &id
	}
	return domainchat.ReconstructBot(
		domainshared.IDFromUUID(po.ID), domainshared.IDFromUUID(po.UserID),
		po.Name, avatarID, po.TokenHash, r.plainToken(po), po.Enabled, po.CreatedAt, po.UpdatedAt,
	)
}

// plainToken 从密文列取回明文。任何取不回的情况都归一为空串 + 一条 warn：
// 鉴权走 token_hash，密文解不开只影响「能不能查看」，不该让 bot 从列表里消失。
func (r *BotRepository) plainToken(po model.ChatBot) string {
	if po.TokenEncrypted == nil || *po.TokenEncrypted == "" {
		return ""
	}
	if r.box == nil {
		log.Warn().Str("bot_id", po.ID.String()).
			Msg("已存有 bot 凭据密文，但 BOT_TOKEN_KEY 未配置，无法解密查看")
		return ""
	}
	plain, err := r.box.Open(*po.TokenEncrypted)
	if err != nil {
		log.Warn().Err(err).Str("bot_id", po.ID.String()).
			Msg("bot 凭据密文解密失败（BOT_TOKEN_KEY 已更换？），只能重置该 bot 的 token")
		return ""
	}
	// 密文与哈希必须描述同一个 token：对不上就说明行被拼过或密钥与数据来路不一致，
	// 宁可不展示也不能把一个过不了的凭据递给用户。
	if domainchat.HashBotToken(plain) != po.TokenHash {
		log.Warn().Str("bot_id", po.ID.String()).
			Msg("bot 凭据明文与 token_hash 不匹配，不对外展示")
		return ""
	}
	return plain
}

// 编译期断言：BotRepository 实现领域端口
var _ domainchat.BotRepository = (*BotRepository)(nil)
