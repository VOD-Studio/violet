package gorm

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	appchat "blog-api/internal/application/chat"
	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
	"blog-api/internal/infrastructure/crypto"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// BotAvatarUnitOfWork 串行化同一 bot 的头像资料写入并原子提交两张表。
type BotAvatarUnitOfWork struct {
	db  *gorm.DB
	box *crypto.TokenBox
}

// NewBotAvatarUnitOfWork 在事务内沿用 bot 凭据加解密配置。
func NewBotAvatarUnitOfWork(db *gorm.DB, box *crypto.TokenBox) *BotAvatarUnitOfWork {
	return &BotAvatarUnitOfWork{db: db, box: box}
}

// Do 锁定当前 bot 和虚拟用户后执行资料与素材引用更新，回调失败全部回滚。
func (u *BotAvatarUnitOfWork) Do(ctx context.Context, botID domainshared.ID, fn func(appchat.BotAvatarTransaction) error) error {
	return u.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var bot model.ChatBot
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", botID.UUID()).Take(&bot).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domainshared.Unauthorized("Bot Token 已失效")
		}
		if err != nil {
			return err
		}
		var user model.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", bot.UserID).Take(&user).Error; err != nil {
			return err
		}
		return fn(&botAvatarTransaction{
			bots: NewBotRepository(tx, u.box), users: NewUserRepository(tx),
			files: NewFileRepository(tx.Clauses(clause.Locking{Strength: "UPDATE"})),
		})
	})
}

type botAvatarTransaction struct {
	bots  domainchat.BotRepository
	users domainuser.UserRepository
	files appchat.FileRepository
}

func (t *botAvatarTransaction) Bots() domainchat.BotRepository   { return t.bots }
func (t *botAvatarTransaction) Users() domainuser.UserRepository { return t.users }
func (t *botAvatarTransaction) Files() appchat.FileRepository    { return t.files }

var _ appchat.BotAvatarUnitOfWork = (*BotAvatarUnitOfWork)(nil)
