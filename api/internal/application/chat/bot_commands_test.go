package chat

import (
	"context"
	"testing"
	"time"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
)

type catalogConversationRepo struct {
	domainchat.ConversationRepository
	conversation *domainchat.Conversation
	members      []*domainchat.Member
}

func (r *catalogConversationRepo) FindByIDForMember(_ context.Context, _, userID domainshared.ID) (*domainchat.Conversation, error) {
	for _, member := range r.members {
		if member.UserID() == userID && member.IsActive() {
			return r.conversation, nil
		}
	}
	return nil, domainchat.ErrConversationNotFound
}

func (r *catalogConversationRepo) ListMembers(context.Context, domainshared.ID, bool) ([]*domainchat.Member, error) {
	return r.members, nil
}

type memoryCatalogRepo struct {
	catalogs map[domainshared.ID]domainchat.BotCommandCatalog
}

func (r *memoryCatalogRepo) Replace(_ context.Context, catalog domainchat.BotCommandCatalog) error {
	if prior, ok := r.catalogs[catalog.BotID]; !ok || prior.Revision != catalog.Revision {
		r.catalogs[catalog.BotID] = catalog
	}
	return nil
}

func (r *memoryCatalogRepo) ListByBotIDs(_ context.Context, botIDs []domainshared.ID) (map[domainshared.ID]domainchat.BotCommandCatalog, error) {
	out := map[domainshared.ID]domainchat.BotCommandCatalog{}
	for _, id := range botIDs {
		if catalog, ok := r.catalogs[id]; ok {
			out[id] = catalog
		}
	}
	return out, nil
}

func TestBotCommandServiceMemberVisibilityAndRevocation(t *testing.T) {
	now := time.Now()
	memberID, outsiderID, enabledID, disabledID, unpublishedID := domainshared.NewID(), domainshared.NewID(), domainshared.NewID(), domainshared.NewID(), domainshared.NewID()
	conversation, err := domainchat.NewConversation(domainchat.ConversationRoom, memberID, "房间", now)
	if err != nil {
		t.Fatal(err)
	}
	repo := &catalogConversationRepo{conversation: conversation}
	for _, id := range []domainshared.ID{memberID, enabledID, disabledID, unpublishedID} {
		member, err := domainchat.NewMember(conversation.ID(), id, domainchat.MemberMember, now)
		if err != nil {
			t.Fatal(err)
		}
		repo.members = append(repo.members, member)
	}
	enabledBot := newTestBotForUser(t, enabledID, "Saber", true)
	disabledBot := newTestBotForUser(t, disabledID, "Offline", false)
	unpublishedBot := newTestBotForUser(t, unpublishedID, "Unpublished", true)
	bots := newFakeBotRepo()
	bots.bots[enabledBot.ID()], bots.bots[disabledBot.ID()] = enabledBot, disabledBot
	bots.bots[unpublishedBot.ID()] = unpublishedBot
	users := newFakeUserStore()
	for _, item := range []struct {
		id   domainshared.ID
		name string
	}{{enabledID, "saber"}, {disabledID, "offline"}, {unpublishedID, "unpublished"}} {
		users.users[item.id] = domainuser.NewUser(item.id, mustEmail(t, item.name+"@example.com"), mustUsername(t, item.name), domainuser.NewPasswordHash("x"))
	}
	catalogs := &memoryCatalogRepo{catalogs: map[domainshared.ID]domainchat.BotCommandCatalog{}}
	svc := NewBotCommandService(repo, bots, catalogs, users)
	command := domainchat.BotCommand{ID: "task.list", Path: []string{"task", "list"}, Description: "查看任务", Scope: "conversation"}
	if _, err := svc.PublishBotCommands(context.Background(), enabledBot, 1, []domainchat.BotCommand{command}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.PublishBotCommands(context.Background(), disabledBot, 1, []domainchat.BotCommand{command}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.ListBotCommands(context.Background(), outsiderID, conversation.ID()); err == nil {
		t.Fatal("非成员不得读取目录")
	}
	result, err := svc.ListBotCommands(context.Background(), memberID, conversation.ID())
	if err != nil || len(result.Bots) != 2 {
		t.Fatalf("只能读取启用成员 bot 的目录: %+v, %v", result, err)
	}
	byID := map[string]BotCommandDTO{}
	for _, item := range result.Bots {
		byID[item.BotUserID] = item
	}
	if byID[enabledID.String()].Username != "saber" || byID[unpublishedID.String()].Revision != "" || len(byID[unpublishedID.String()].Commands) != 0 {
		t.Fatalf("未发布目录的启用 bot 仍须可见且命令为空: %+v", result)
	}
	oldRevision := byID[enabledID.String()].Revision
	if _, err := svc.PublishBotCommands(context.Background(), enabledBot, 1, []domainchat.BotCommand{}); err != nil {
		t.Fatal(err)
	}
	result, err = svc.ListBotCommands(context.Background(), memberID, conversation.ID())
	byID = map[string]BotCommandDTO{}
	for _, item := range result.Bots {
		byID[item.BotUserID] = item
	}
	if err != nil || len(result.Bots) != 2 || len(byID[enabledID.String()].Commands) != 0 || byID[enabledID.String()].Revision == oldRevision {
		t.Fatalf("空目录必须撤销命令: %+v, %v", result, err)
	}
}
