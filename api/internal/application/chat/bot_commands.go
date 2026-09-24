package chat

import (
	"context"
	"sort"
	"time"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
)

// BotCommandDTO 是当前会话可见的单个 bot 目录。
type BotCommandDTO struct {
	BotUserID string                  `json:"bot_user_id"`
	Username  string                  `json:"username"`
	Name      string                  `json:"name"`
	Revision  string                  `json:"revision"`
	Commands  []domainchat.BotCommand `json:"commands"`
}

// BotCommandsDTO 返回当前会话中已启用的 bot。
type BotCommandsDTO struct {
	Bots []BotCommandDTO `json:"bots"`
}

// BotCommandService 编排目录发布和成员可见范围。
type BotCommandService struct {
	conversations domainchat.ConversationRepository
	bots          domainchat.BotRepository
	catalogs      domainchat.BotCommandCatalogRepository
	users         UserRepository
	now           func() time.Time
}

func NewBotCommandService(conversations domainchat.ConversationRepository, bots domainchat.BotRepository, catalogs domainchat.BotCommandCatalogRepository, users UserRepository) *BotCommandService {
	return &BotCommandService{conversations: conversations, bots: bots, catalogs: catalogs, users: users, now: time.Now}
}

// PublishBotCommands 只能替换鉴权凭证所属 bot 的目录。
func (s *BotCommandService) PublishBotCommands(ctx context.Context, bot *domainchat.Bot, version int, commands []domainchat.BotCommand) (string, error) {
	catalog, err := domainchat.NewBotCommandCatalog(bot.ID(), version, commands, s.now())
	if err != nil {
		return "", err
	}
	if err := s.catalogs.Replace(ctx, catalog); err != nil {
		return "", err
	}
	return catalog.Revision, nil
}

// ListBotCommands 仅向有效成员返回本会话内启用 bot 的目录。
func (s *BotCommandService) ListBotCommands(ctx context.Context, userID, conversationID domainshared.ID) (BotCommandsDTO, error) {
	if _, err := s.conversations.FindByIDForMember(ctx, conversationID, userID); err != nil {
		return BotCommandsDTO{}, err
	}
	members, err := s.conversations.ListMembers(ctx, conversationID, false)
	if err != nil {
		return BotCommandsDTO{}, err
	}
	memberIDs := make([]domainshared.ID, 0, len(members))
	for _, member := range members {
		if member.IsActive() {
			memberIDs = append(memberIDs, member.UserID())
		}
	}
	bots, err := s.bots.ListByUserIDs(ctx, memberIDs)
	if err != nil {
		return BotCommandsDTO{}, err
	}
	botIDs, botUsers := make([]domainshared.ID, 0, len(bots)), make([]domainshared.ID, 0, len(bots))
	for _, bot := range bots {
		if bot.IsEnabled() {
			botIDs = append(botIDs, bot.ID())
			botUsers = append(botUsers, bot.UserID())
		}
	}
	catalogs, err := s.catalogs.ListByBotIDs(ctx, botIDs)
	if err != nil {
		return BotCommandsDTO{}, err
	}
	users, err := s.users.FindByIDs(ctx, botUsers)
	if err != nil {
		return BotCommandsDTO{}, err
	}
	usernames := make(map[domainshared.ID]string, len(users))
	for _, user := range users {
		usernames[user.GetID()] = user.Username().String()
	}
	result := BotCommandsDTO{Bots: []BotCommandDTO{}}
	for _, bot := range bots {
		catalog, ok := catalogs[bot.ID()]
		if !bot.IsEnabled() || usernames[bot.UserID()] == "" {
			continue
		}
		commands, revision := []domainchat.BotCommand{}, ""
		if ok {
			commands, revision = catalog.Commands, catalog.Revision
		}
		result.Bots = append(result.Bots, BotCommandDTO{
			BotUserID: bot.UserID().String(), Username: usernames[bot.UserID()],
			Name: bot.Name(), Revision: revision, Commands: commands,
		})
	}
	sort.Slice(result.Bots, func(i, j int) bool {
		if result.Bots[i].Name == result.Bots[j].Name {
			return result.Bots[i].BotUserID < result.Bots[j].BotUserID
		}
		return result.Bots[i].Name < result.Bots[j].Name
	})
	return result, nil
}
