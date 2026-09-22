package chat

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
	domainuser "blog-api/internal/domain/user"
)

// botUserEmailDomain bot 虚拟用户的邮箱域。`.invalid` 是 RFC 2606 保留 TLD，
// 永不解析：邮箱字段被误用于发信也不会投递出去。
const botUserEmailDomain = "bot.violet.invalid"

// BotDTO bot 读模型。
//
// Token 为明文凭据：仅创建、重置与「查看凭据」三个响应携带，列表恒为空。
// Username 是 bot 虚拟用户的寻址名（@mention 用它），Name 是显示名。
type BotDTO struct {
	// ID bot 凭证 ID。
	ID string `json:"id"`
	// UserID bot 对应的虚拟用户 ID，消息 sender.id 即此值。
	UserID string `json:"user_id"`
	// Username 虚拟用户名，@提及与私聊寻址用。
	Username string `json:"username"`
	// Name 显示名。
	Name string `json:"name"`
	// AvatarID 头像文件 ID，未设置时为空。
	AvatarID string `json:"avatar_id,omitempty"`
	// AvatarURL 头像地址，取自虚拟用户资料。
	AvatarURL string `json:"avatar_url,omitempty"`
	// Enabled 是否启用；禁用后 token 鉴权即拒。
	Enabled bool `json:"enabled"`
	// Token 明文 token，仅创建/重置/查看凭据时返回，列表不携带。
	Token string `json:"token,omitempty"`
	// TokenViewable 当前能否取回明文：false = 库里没存密文（早于密文列创建、
	// 未配 BOT_TOKEN_KEY、或密钥已换），后台得提示重置而不是让操作者撞错误。
	TokenViewable bool `json:"token_viewable"`
	// CreatedAt 创建时间（RFC3339Nano）。
	CreatedAt string `json:"created_at"`
	// UpdatedAt 最近更新时间（RFC3339Nano）。
	UpdatedAt string `json:"updated_at"`
}

// CreateBotInput 注册 bot 入参。
type CreateBotInput struct {
	// Name 显示名，同步为虚拟用户的 display_name。
	Name string
	// Username 虚拟用户名，需满足 Username 值对象格式且未被占用。
	Username string
	// AvatarID 头像文件 ID；零值表示不设头像。
	AvatarID domainshared.ID
}

// UpdateBotInput 修改 bot 入参。指针字段为 nil 表示不改动。
type UpdateBotInput struct {
	// ID 目标 bot。
	ID domainshared.ID
	// Name 新显示名；nil 表示不改名。
	Name *string
	// AvatarID 新头像文件 ID 字符串；nil 表示不改头像，空串表示清除头像。
	AvatarID *string
	// Enabled 启停；nil 表示不改。
	Enabled *bool
}

// BotService 聊天 bot 凭证的管理与鉴权用例。
type BotService struct {
	bots  domainchat.BotRepository
	users domainuser.UserRepository
	files FileRepository
	bus   appshared.EventBus
	now   func() time.Time
}

// NewBotService 构造 bot 管理服务。files 为 nil 时不接受头像入参。
func NewBotService(
	bots domainchat.BotRepository,
	users domainuser.UserRepository,
	files FileRepository,
	bus appshared.EventBus,
	now func() time.Time,
) *BotService {
	if now == nil {
		now = time.Now
	}
	return &BotService{bots: bots, users: users, files: files, bus: bus, now: now}
}

// CreateBot 注册 bot：建虚拟用户 + bot 凭证。
//
// 返回的 DTO.Token 是刚签发的明文。虚拟用户不设密码
// （password_hash 为空，与 OAuth-only 用户同构），因此只能经 bot token 鉴权，
// 永远无法用密码登录本站。
//
// 用户名被已吊销 bot 的虚拟用户占着时不判冲突，而是回收复用那个用户：吊销只删
// 凭证、留着用户以保住历史消息的署名，于是同名重建会永远撞在自己留下的空壳上。
// 复用既把名字还给管理员，也让新凭证接上同一主体的历史。
//
// 不用事务包住两条写：本项目的多表原子性归仓储实现（见 ChatRepository
// .SaveConversation），这里跨的又是两个聚合，改由「bot 写失败 → 补偿删除刚建的
// 用户」收敛，避免为一个创建路径引入 UoW 装配。补偿只限本次新建的用户——回收来
// 的空壳名下有历史消息，删它会连带抹掉记录。
func (s *BotService) CreateBot(ctx context.Context, in CreateBotInput) (BotDTO, error) {
	username, err := domainuser.ParseUsername(strings.TrimSpace(in.Username))
	if err != nil {
		return BotDTO{}, err
	}
	// shell 非 nil = 这个名字属于一个已吊销 bot 留下的空壳，可以直接复用。
	shell, err := s.reclaimableShell(ctx, username)
	if err != nil {
		return BotDTO{}, err
	}

	avatarID, avatar, err := s.resolveAvatar(ctx, in.AvatarID)
	if err != nil {
		return BotDTO{}, err
	}

	now := s.now()
	botID := domainshared.NewID()
	freshUser := shell == nil
	user := shell
	if freshUser {
		userID := domainshared.NewID()
		email, perr := domainuser.ParseEmail("bot+" + userID.String() + "@" + botUserEmailDomain)
		if perr != nil {
			return BotDTO{}, domainshared.Internal("构造 bot 虚拟用户邮箱失败", perr)
		}
		user = domainuser.NewUser(userID, email, username, domainuser.NewPasswordHash(""))
		user.VerifyEmail()
	} else {
		user.Activate()
	}
	if displayName, derr := domainuser.ParseDisplayName(strings.TrimSpace(in.Name)); derr == nil {
		user.UpdateDisplayName(displayName)
	}
	if avatar != nil {
		user.UpdateAvatarURL(avatar.URL())
	} else {
		// 没选头像时要连旧头像一起清掉：注册表单是空的、界面却显示上一任的图，
		// 管理员看到的就不是他刚提交的那个 bot。
		user.UpdateAvatarURL("")
	}
	bot, token, err := domainchat.NewBot(botID, user.GetID(), in.Name, avatarID, now)
	if err != nil {
		return BotDTO{}, err
	}

	if err := s.users.Save(ctx, user); err != nil {
		return BotDTO{}, err
	}
	if err := s.bots.Save(ctx, bot); err != nil {
		if freshUser {
			s.compensateUser(ctx, user.GetID())
		}
		return BotDTO{}, err
	}
	s.publishEvents(ctx, user.PullEvents(), bot.PullEvents())
	dto := newBotDTO(bot, user)
	dto.Token = token.Value
	return dto, nil
}

// reclaimableShell 判定用户名占用者能否回收：空闲与已吊销 bot 的空壳分别返回
// (nil, nil) 与 (user, nil)，其余占用一律 ErrUsernameExists。
//
// 除邮箱形态外还要求名下确实没有凭证：还挂着凭证的 bot 哪怕被禁用也是有主的，
// 同名注册必须撞墙，否则两份凭证共用一个身份。
// 不要求 is_active=false——吊销时的停用是尽力而为（写失败只记日志），以凭证为准
// 才不会留下「停不掉就永久占名」的死角。
func (s *BotService) reclaimableShell(ctx context.Context, username domainuser.Username) (*domainuser.User, error) {
	occupant, err := s.users.FindByUsername(ctx, username)
	if errors.Is(err, domainuser.ErrNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if !isBotVirtualUser(occupant) {
		return nil, domainuser.ErrUsernameExists
	}
	_, berr := s.bots.FindByUserID(ctx, occupant.GetID())
	switch {
	case berr == nil:
		return nil, domainuser.ErrUsernameExists
	case errors.Is(berr, domainchat.ErrBotNotFound):
		return occupant, nil
	default:
		return nil, berr
	}
}

// isBotVirtualUser 账号是否为系统为 bot 建的虚拟用户。
//
// 邮箱形态是 bot+<自身用户 ID>@bot.violet.invalid，连本地部分的 ID 一起核对：
// 只看后缀会把真用户误判成可回收的空壳，等于给注册开放抢名。
func isBotVirtualUser(u *domainuser.User) bool {
	local, domain, found := strings.Cut(u.Email().String(), "@")
	return found && domain == botUserEmailDomain && local == "bot+"+u.GetID().String()
}

// GetBot 查询 bot 详情。
func (s *BotService) GetBot(ctx context.Context, id domainshared.ID) (BotDTO, error) {
	bot, err := s.bots.FindByID(ctx, id)
	if err != nil {
		return BotDTO{}, err
	}
	user, err := s.users.FindByID(ctx, bot.UserID())
	if err != nil {
		return BotDTO{}, err
	}
	return newBotDTO(bot, user), nil
}

// ListBots 分页列出 bot。
//
// 缺用户的 bot 行（虚拟用户被管理员删除）跳过而不报错：凭证已无主体，
// 让它出现在列表里只会诱导管理员去操作一个不存在的用户。
func (s *BotService) ListBots(ctx context.Context, q domainshared.PageQuery) (domainshared.PageResult[BotDTO], error) {
	page, err := s.bots.ListPage(ctx, q)
	if err != nil {
		return domainshared.PageResult[BotDTO]{}, err
	}
	userIDs := make([]domainshared.ID, 0, len(page.Items))
	for _, bot := range page.Items {
		userIDs = append(userIDs, bot.UserID())
	}
	users, err := s.users.FindByIDs(ctx, userIDs)
	if err != nil {
		return domainshared.PageResult[BotDTO]{}, err
	}
	byID := make(map[domainshared.ID]*domainuser.User, len(users))
	for _, user := range users {
		byID[user.GetID()] = user
	}
	items := make([]BotDTO, 0, len(page.Items))
	for _, bot := range page.Items {
		user, ok := byID[bot.UserID()]
		if !ok {
			continue
		}
		items = append(items, newBotDTO(bot, user))
	}
	return domainshared.NewPageResult(q, items, page.Total), nil
}

// UpdateBot 改名、换头像与启停。未提供任何待改字段时只回读，不写库。
func (s *BotService) UpdateBot(ctx context.Context, in UpdateBotInput) (BotDTO, error) {
	bot, err := s.bots.FindByID(ctx, in.ID)
	if err != nil {
		return BotDTO{}, err
	}
	user, err := s.users.FindByID(ctx, bot.UserID())
	if err != nil {
		return BotDTO{}, err
	}
	now := s.now()
	changed := false

	if in.Name != nil {
		previous := bot.Name()
		if err := bot.Rename(*in.Name, now); err != nil {
			return BotDTO{}, err
		}
		if displayName, derr := domainuser.ParseDisplayName(strings.TrimSpace(*in.Name)); derr == nil {
			user.UpdateDisplayName(displayName)
		}
		changed = changed || previous != bot.Name()
	}
	if in.AvatarID != nil {
		avatarID, avatar, err := s.parseAvatarID(ctx, *in.AvatarID)
		if err != nil {
			return BotDTO{}, err
		}
		bot.SetAvatar(avatarID, now)
		if avatar != nil {
			user.UpdateAvatarURL(avatar.URL())
		} else {
			user.UpdateAvatarURL("")
		}
		changed = true
	}
	if in.Enabled != nil {
		if *in.Enabled {
			bot.Enable(now)
		} else {
			bot.Disable(now)
		}
		changed = true
	}
	if changed {
		if err := s.bots.Save(ctx, bot); err != nil {
			return BotDTO{}, err
		}
		if err := s.users.Save(ctx, user); err != nil {
			return BotDTO{}, err
		}
		s.publishEvents(ctx, bot.PullEvents(), user.PullEvents())
	}
	return newBotDTO(bot, user), nil
}

// RegenerateToken 重置 token，旧 token 立即失效。返回的 DTO.Token 是新明文。
func (s *BotService) RegenerateToken(ctx context.Context, id domainshared.ID) (BotDTO, error) {
	bot, err := s.bots.FindByID(ctx, id)
	if err != nil {
		return BotDTO{}, err
	}
	user, err := s.users.FindByID(ctx, bot.UserID())
	if err != nil {
		return BotDTO{}, err
	}
	token, err := bot.RegenerateToken(s.now())
	if err != nil {
		return BotDTO{}, err
	}
	if err := s.bots.Save(ctx, bot); err != nil {
		return BotDTO{}, err
	}
	s.publishEvents(ctx, bot.PullEvents())
	dto := newBotDTO(bot, user)
	dto.Token = token.Value
	return dto, nil
}

// RevealToken 取回 bot 当前可用的明文凭据，供后台随时查看。
//
// 查看不动聚合状态，所以直接构造事件而不是 RecordEvent；审计要记下「谁在什么时候
// 看了哪个 bot 的凭据」，但绝不记凭据本身。
//
// 明文为空时必须报错而非返回空串：空串会被前端当成一个可用 token 展示出去。
// 置空只有两种成因——密文列上线前建的 bot，或者 BOT_TOKEN_KEY 换过。
func (s *BotService) RevealToken(ctx context.Context, id domainshared.ID) (BotDTO, error) {
	bot, err := s.bots.FindByID(ctx, id)
	if err != nil {
		return BotDTO{}, err
	}
	plain := bot.Token()
	if plain == "" {
		return BotDTO{}, domainshared.BadRequest("该 Bot 的 token 无法查看（凭据未加密保存或密钥已变更），请重置 token")
	}
	user, err := s.users.FindByID(ctx, bot.UserID())
	if err != nil {
		return BotDTO{}, err
	}
	s.publishEvents(ctx, []domainshared.DomainEvent{domainchat.NewBotTokenViewed(bot.ID(), bot.Name())})
	dto := newBotDTO(bot, user)
	dto.Token = plain
	return dto, nil
}

// DeleteBot 吊销 bot 凭证并停用其虚拟用户。
//
// 只删凭证、不删用户：chat_messages.sender_id 对 users 是 ON DELETE CASCADE，
// 删用户会连带抹掉它发过的全部消息，毁掉可追溯的聊天历史。停用
// （is_active=false）足以让它在联系人搜索里消失，历史消息仍照常署名。
func (s *BotService) DeleteBot(ctx context.Context, id domainshared.ID) error {
	bot, err := s.bots.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if err := s.bots.Delete(ctx, id); err != nil {
		return err
	}
	if user, uerr := s.users.FindByID(ctx, bot.UserID()); uerr == nil {
		user.Deactivate()
		if serr := s.users.Save(ctx, user); serr != nil {
			log.Warn().Err(serr).Str("bot_id", id.String()).Msg("吊销 bot 后停用虚拟用户失败")
		}
		s.publishEvents(ctx, user.PullEvents())
	} else if !errors.Is(uerr, domainuser.ErrNotFound) {
		return uerr
	}
	s.publishEvents(ctx, []domainshared.DomainEvent{domainchat.NewBotDeleted(bot.ID(), bot.UserID(), bot.Name())})
	return nil
}

// FindByToken 按明文 token 查 bot，供 BotAuth 中间件鉴权。
//
// 空 token 直接判不存在：不先哈希，避免把「未携带凭据」与「凭据无效」
// 混成同一条哈希查询（也省掉对空串哈希的索引命中）。
func (s *BotService) FindByToken(ctx context.Context, rawToken string) (*domainchat.Bot, error) {
	token := strings.TrimSpace(rawToken)
	if token == "" {
		return nil, domainchat.ErrBotNotFound
	}
	return s.bots.FindByToken(ctx, domainchat.HashBotToken(token))
}

// resolveAvatar 校验头像文件并返回 ID 与实体；id 为零值时返回 (nil, nil, nil)。
//
// 不校验文件归属：本方法只服务管理端点，管理员本就可见全部素材。
func (s *BotService) resolveAvatar(ctx context.Context, id domainshared.ID) (*domainshared.ID, *domainupload.File, error) {
	if id.IsZero() {
		return nil, nil, nil
	}
	if s.files == nil {
		return nil, nil, domainshared.BadRequest("头像服务未启用")
	}
	file, err := s.files.FindByID(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	if file.Status() != domainupload.StatusReady || !strings.HasPrefix(file.MimeType(), "image/") {
		return nil, nil, domainshared.BadRequest("头像必须是已就绪的图片")
	}
	avatarID := id
	return &avatarID, file, nil
}

// parseAvatarID 解析 UpdateBotInput.AvatarID：空串=清除，非法 ID=400。
func (s *BotService) parseAvatarID(ctx context.Context, value string) (*domainshared.ID, *domainupload.File, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, nil, nil
	}
	id, err := domainshared.ParseID(trimmed)
	if err != nil {
		return nil, nil, domainshared.BadRequest("头像 ID 格式非法")
	}
	return s.resolveAvatar(ctx, id)
}

// newBotDTO 组装读模型。明文 token 不在此处出现，由调用方按需附加。
func newBotDTO(bot *domainchat.Bot, user *domainuser.User) BotDTO {
	dto := BotDTO{
		ID:            bot.ID().String(),
		UserID:        bot.UserID().String(),
		Username:      user.Username().String(),
		Name:          bot.Name(),
		Enabled:       bot.IsEnabled(),
		TokenViewable: bot.Token() != "",
		AvatarURL:     user.AvatarURL(),
		CreatedAt:     bot.CreatedAt.Format(time.RFC3339Nano),
		UpdatedAt:     bot.UpdatedAt.Format(time.RFC3339Nano),
	}
	if bot.AvatarID() != nil {
		dto.AvatarID = bot.AvatarID().String()
	}
	return dto
}

// compensateUser 回滚刚创建的虚拟用户。补偿失败只记日志：此时凭证未落库，
// 残留的是一个无密码、无 bot 关联的普通用户，可由管理员在用户后台删除。
func (s *BotService) compensateUser(ctx context.Context, userID domainshared.ID) {
	if err := s.users.Delete(ctx, userID); err != nil {
		log.Warn().Err(err).Str("user_id", userID.String()).Msg("创建 bot 失败后清理虚拟用户未成功")
	}
}

// publishEvents 把多个聚合的事件一次性投递到总线（审计订阅者消费）。
func (s *BotService) publishEvents(ctx context.Context, eventSets ...[]domainshared.DomainEvent) {
	if s.bus == nil {
		return
	}
	var all []domainshared.DomainEvent
	for _, set := range eventSets {
		all = append(all, set...)
	}
	if len(all) > 0 {
		_ = s.bus.Publish(ctx, all)
	}
}

// BotProfile 返回 bot 自查的身份信息（Bot API 的 GET /profile）。
func (s *BotService) BotProfile(ctx context.Context, bot *domainchat.Bot) (BotDTO, error) {
	user, err := s.users.FindByID(ctx, bot.UserID())
	if err != nil {
		return BotDTO{}, err
	}
	return newBotDTO(bot, user), nil
}
