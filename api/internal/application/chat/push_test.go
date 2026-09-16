package chat

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
)

type pushLifecycleRepo struct {
	mentionChatRepo
}

func (r *pushLifecycleRepo) DeletePushSubscription(_ context.Context, userID domainshared.ID, endpoint string) error {
	subs := r.subs[userID]
	for i, subscription := range subs {
		if subscription.Endpoint == endpoint {
			r.subs[userID] = append(subs[:i], subs[i+1:]...)
			break
		}
	}
	return nil
}

type intermittentPushSender struct {
	calls     int
	delivered int
	err       error
}

func (p *intermittentPushSender) Send(context.Context, *domainchat.PushSubscription, PushPayload) error {
	p.calls++
	if p.calls == 2 {
		return p.err
	}
	p.delivered++
	return nil
}

func TestNotifyEventsPushSubscriptionLifecycle(t *testing.T) {
	for _, tc := range []struct {
		name          string
		err           error
		delivered     int
		subscriptions int
	}{
		{"timeout", context.DeadlineExceeded, 2, 1},
		{"request canceled", context.Canceled, 2, 1},
		{"push service unavailable", errors.New("web push returned 503"), 2, 1},
		{"subscription expired", fmt.Errorf("provider: %w", ErrPushSubscriptionExpired), 1, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			now := time.Now()
			conversationID, userID := domainshared.NewID(), domainshared.NewID()
			repo := &pushLifecycleRepo{mentionChatRepo: mentionChatRepo{
				members: map[domainshared.ID]*domainchat.Member{
					userID: domainchat.ReconstructMember(conversationID, userID, domainchat.MemberMember, now, nil, false),
				},
				subs: map[domainshared.ID][]*domainchat.PushSubscription{
					userID: {{UserID: userID, Endpoint: "https://push.example/subscription"}},
				},
			}}
			push := &intermittentPushSender{err: tc.err}
			svc := NewService(repo, nil, nil, nil, push, "", nil, nil, nil, nil, nil)
			for sequence := int64(1); sequence <= 3; sequence++ {
				svc.notifyEvents(context.Background(), []domainchat.Event{{
					Sequence: sequence, UserID: userID, Type: domainchat.EventMessageCreated,
					Payload: map[string]any{"conversation_id": conversationID.String()},
				}})
			}
			require.Equal(t, tc.delivered, push.delivered)
			require.Len(t, repo.subs[userID], tc.subscriptions)
		})
	}
}
