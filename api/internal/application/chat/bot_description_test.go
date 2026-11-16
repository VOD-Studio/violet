package chat

import (
	"context"
	"strings"
	"testing"
	"time"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
)

func TestUpdateBotDescriptionIsTrimmedAndClearable(t *testing.T) {
	ctx := context.Background()
	svc, _, _, _ := newBotService(t)
	created, err := svc.CreateBot(ctx, CreateBotInput{Name: "Rua", Username: "rua"})
	if err != nil {
		t.Fatal(err)
	}
	if created.Description != "" {
		t.Fatalf("新建 bot 简介应为空: %+v", created)
	}
	botID := domainshared.MustParseID(created.ID)

	text := "  看板娘，爱推荐歌  "
	dto, err := svc.UpdateBot(ctx, UpdateBotInput{ID: botID, Description: &text})
	if err != nil || dto.Description != "看板娘，爱推荐歌" {
		t.Fatalf("简介应去掉首尾空白后保存: %+v, %v", dto, err)
	}

	cleared := "   "
	dto, err = svc.UpdateBot(ctx, UpdateBotInput{ID: botID, Description: &cleared})
	if err != nil || dto.Description != "" {
		t.Fatalf("空白简介应清空: %+v, %v", dto, err)
	}

	tooLong := strings.Repeat("长", 81)
	if _, err := svc.UpdateBot(ctx, UpdateBotInput{ID: botID, Description: &tooLong}); err == nil {
		t.Fatal("超过 80 个字符的简介必须拒绝")
	}
}

func TestListBotCommandsCarriesBotDescription(t *testing.T) {
	now := time.Now()
	memberID, botUserID := domainshared.NewID(), domainshared.NewID()
	conversation, err := domainchat.NewConversation(domainchat.ConversationRoom, memberID, "房间", now)
	if err != nil {
		t.Fatal(err)
	}
	repo := &catalogConversationRepo{conversation: conversation}
	for _, id := range []domainshared.ID{memberID, botUserID} {
		member, err := domainchat.NewMember(conversation.ID(), id, domainchat.MemberMember, now)
		if err != nil {
			t.Fatal(err)
		}
		repo.members = append(repo.members, member)
	}
	bot := newTestBotForUser(t, botUserID, "Rua", true)
	if err := bot.SetDescription("看板娘，爱推荐歌", now); err != nil {
		t.Fatal(err)
	}
	bots := newFakeBotRepo()
	bots.bots[bot.ID()] = bot
	users := newFakeUserStore()
	users.users[botUserID] = domainuser.NewUser(botUserID, mustEmail(t, "rua@example.com"), mustUsername(t, "rua"), domainuser.NewPasswordHash("x"))
	svc := NewBotCommandService(repo, bots, &memoryCatalogRepo{catalogs: map[domainshared.ID]domainchat.BotCommandCatalog{}}, users)

	result, err := svc.ListBotCommands(context.Background(), memberID, conversation.ID())
	if err != nil || len(result.Bots) != 1 || result.Bots[0].Description != "看板娘，爱推荐歌" {
		t.Fatalf("会话 bot 目录应带简介: %+v, %v", result, err)
	}
}
