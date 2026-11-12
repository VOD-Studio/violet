package chat

import (
	"context"
	"errors"
	"time"

	"github.com/rs/zerolog/log"

	appmedia "blog-api/internal/application/media"
	appshared "blog-api/internal/application/shared"
	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
	domainuser "blog-api/internal/domain/user"
)

// MaxBotAvatarBytes 是头像原始文件的字节上限，不包含 multipart 开销。
const MaxBotAvatarBytes = 10 << 20

// BotAvatarUploader 保存归当前虚拟用户所有、purpose=avatar 的真实图片。
type BotAvatarUploader interface {
	SaveBotAvatar(context.Context, appmedia.SaveBotMediaInput) (appmedia.BotMediaDTO, error)
}

// BotAvatarTransaction 的仓储共享事务；当前 bot 与虚拟用户已加写锁。
type BotAvatarTransaction interface {
	Bots() domainchat.BotRepository
	Users() domainuser.UserRepository
	Files() FileRepository
}

// BotAvatarUnitOfWork 保证 bot 的头像引用与虚拟用户资料一同提交。
type BotAvatarUnitOfWork interface {
	Do(context.Context, domainshared.ID, func(BotAvatarTransaction) error) error
}

// BotAvatarService 只为经过鉴权的 bot 更换自身头像，不接受目标 ID。
type BotAvatarService struct {
	uploader BotAvatarUploader
	uow      BotAvatarUnitOfWork
	bus      appshared.EventBus
}

// NewBotAvatarService 绑定真实上传与资料事务；缺少任一依赖时 Set 拒绝写入。
func NewBotAvatarService(uploader BotAvatarUploader, uow BotAvatarUnitOfWork, bus appshared.EventBus) *BotAvatarService {
	return &BotAvatarService{uploader: uploader, uow: uow, bus: bus}
}

// Set 保存头像后原子更新资料；资料提交失败时保留已上传但未引用的素材。
func (s *BotAvatarService) Set(ctx context.Context, authenticated *domainchat.Bot, in appmedia.SaveBotMediaInput) (BotDTO, error) {
	if authenticated == nil {
		return BotDTO{}, domainshared.Unauthorized("缺少或无效的 Bot Token")
	}
	if !authenticated.IsEnabled() {
		return BotDTO{}, domainshared.Forbidden("Bot 已禁用")
	}
	if s.uploader == nil || s.uow == nil {
		return BotDTO{}, domainshared.Internal("Bot 头像上传未启用", nil)
	}
	if len(in.Data) == 0 || len(in.Data) > MaxBotAvatarBytes {
		return BotDTO{}, domainshared.BadRequest("头像不能为空或超过 10 MiB")
	}
	in.OwnerID = authenticated.UserID()
	media, err := s.uploader.SaveBotAvatar(ctx, in)
	if err != nil {
		return BotDTO{}, err
	}
	fileID, err := domainshared.ParseID(media.ID)
	if err != nil {
		return BotDTO{}, domainshared.Internal("头像上传未返回有效文件 ID", err)
	}
	var dto BotDTO
	var events []domainshared.DomainEvent
	err = s.uow.Do(ctx, authenticated.ID(), func(tx BotAvatarTransaction) error {
		current, err := tx.Bots().FindByID(ctx, authenticated.ID())
		if errors.Is(err, domainchat.ErrBotNotFound) {
			return domainshared.Unauthorized("Bot Token 已失效")
		}
		if err != nil {
			return err
		}
		if !current.UserID().Equal(authenticated.UserID()) || current.TokenHash() != authenticated.TokenHash() {
			return domainshared.Unauthorized("Bot Token 已失效")
		}
		if !current.IsEnabled() {
			return domainshared.Forbidden("Bot 已禁用")
		}
		file, err := tx.Files().FindByID(ctx, fileID)
		if err != nil {
			return err
		}
		previousAvatarID := current.AvatarID()
		if !file.OwnerID().Equal(current.UserID()) || file.Purpose() != domainupload.PurposeAvatar || file.Status() != domainupload.StatusReady || file.DeletedAt() != nil {
			return domainshared.Forbidden("头像素材不可用于当前 Bot")
		}
		service := NewBotService(tx.Bots(), tx.Users(), tx.Files(), nil, time.Now)
		dto, events, err = service.updateBot(ctx, UpdateBotInput{ID: current.ID(), AvatarID: &media.ID})
		if err != nil {
			return err
		}
		if previousAvatarID != nil && previousAvatarID.Equal(fileID) {
			return nil
		}
		if err := tx.Files().UpdateRefCount(ctx, fileID, 1); err != nil {
			return err
		}
		if previousAvatarID != nil {
			return tx.Files().UpdateRefCount(ctx, *previousAvatarID, -1)
		}
		return nil
	})
	if err != nil {
		return BotDTO{}, err
	}
	if s.bus != nil {
		if err := s.bus.Publish(ctx, events); err != nil {
			log.Warn().Err(err).Str("bot_id", authenticated.ID().String()).Msg("头像已提交但事件发布失败")
		}
	}
	return dto, nil
}
