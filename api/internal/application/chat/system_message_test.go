package chat

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
)

func TestListMessagesExposesSystemMessageContent(t *testing.T) {
	userID, conversationID := domainshared.NewID(), domainshared.NewID()
	svc, repo := newShareService(t, nil, userID, domainshared.NewID(), conversationID)
	message, err := domainchat.NewSystemMessage(conversationID, userID, "Rua已加入群聊", "system-join", time.Now())
	require.NoError(t, err)
	repo.saved = message

	listed, err := svc.ListMessages(context.Background(), userID, conversationID, "", 20)
	require.NoError(t, err)
	require.Len(t, listed.Items, 1)
	assert.Equal(t, "system", listed.Items[0].Type)
	assert.Equal(t, "Rua已加入群聊", listed.Items[0].Content)
}
