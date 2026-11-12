package chat

import (
	"testing"

	domainchat "blog-api/internal/domain/chat"
	domainchatreaction "blog-api/internal/domain/chatreaction"
	domainshared "blog-api/internal/domain/shared"
)

// NewReactionServiceForTest 供 chat_test 外部测试使用：持久化包反向依赖本包，
// 同包测试再导入它会形成环；返回的函数用于替换仓储里的消息列表。
func NewReactionServiceForTest(
	t *testing.T,
	message *domainchat.Message,
	userID, conversationID domainshared.ID,
	store domainchatreaction.Store,
) (*Service, func([]*domainchat.Message)) {
	t.Helper()
	svc, repo := newReactionService(t, message, userID, conversationID, store)
	return svc, func(messages []*domainchat.Message) { repo.messages = messages }
}
