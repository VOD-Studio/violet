package webpush

import (
	"context"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync/atomic"
	"testing"
	"time"

	webpushlib "github.com/SherClockHolmes/webpush-go"
	"github.com/stretchr/testify/require"

	appchat "blog-api/internal/application/chat"
	domainchat "blog-api/internal/domain/chat"
)

func TestSendClassifiesExpiredSubscriptions(t *testing.T) {
	privateKey, publicKey, err := webpushlib.GenerateVAPIDKeys()
	require.NoError(t, err)
	clientKey, err := ecdh.P256().GenerateKey(rand.Reader)
	require.NoError(t, err)
	auth := make([]byte, 16)
	_, err = rand.Read(auth)
	require.NoError(t, err)

	for _, status := range []int{201, 400, 401, 403, 404, 410, 429, 500, 503} {
		t.Run(strconv.Itoa(status), func(t *testing.T) {
			var calls atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				calls.Add(1)
				w.WriteHeader(status)
			}))
			defer server.Close()
			sender := NewSender(publicKey, privateKey, "mailto:push@example.com")
			err := sender.Send(context.Background(), &domainchat.PushSubscription{
				Endpoint: server.URL,
				P256DH:   base64.RawURLEncoding.EncodeToString(clientKey.PublicKey().Bytes()),
				Auth:     base64.RawURLEncoding.EncodeToString(auth),
			}, appchat.PushPayload{Title: "Test", Tag: "violet-chat"})
			if status == 429 || status >= 500 {
				require.EqualValues(t, 3, calls.Load())
			} else {
				require.EqualValues(t, 1, calls.Load())
			}
			switch status {
			case 201:
				require.NoError(t, err)
			case 404, 410:
				require.ErrorIs(t, err, appchat.ErrPushSubscriptionExpired)
			default:
				require.Error(t, err)
				require.NotErrorIs(t, err, appchat.ErrPushSubscriptionExpired)
			}
		})
	}
}

func TestDeliverPreservesOfflineMessagesAndRetriesTransientErrors(t *testing.T) {
	privateKey, publicKey, err := webpushlib.GenerateVAPIDKeys()
	require.NoError(t, err)
	clientKey, err := ecdh.P256().GenerateKey(rand.Reader)
	require.NoError(t, err)
	auth := make([]byte, 16)
	_, err = rand.Read(auth)
	require.NoError(t, err)

	for _, firstStatus := range []int{429, 503} {
		t.Run(strconv.Itoa(firstStatus), func(t *testing.T) {
			var calls atomic.Int32
			headers := make(chan http.Header, 3)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				headers <- r.Header.Clone()
				if calls.Add(1) == 1 {
					w.WriteHeader(firstStatus)
					return
				}
				w.WriteHeader(http.StatusCreated)
			}))
			defer server.Close()
			sender := NewSender(publicKey, privateKey, "mailto:push@example.com")
			err := sender.Deliver(context.Background(), Subscription{
				Endpoint: server.URL,
				P256DH:   base64.RawURLEncoding.EncodeToString(clientKey.PublicKey().Bytes()),
				Auth:     base64.RawURLEncoding.EncodeToString(auth),
			}, Notification{Title: "Test", Tag: "violet-chat"})
			require.NoError(t, err)
			require.EqualValues(t, 2, calls.Load())
			header := <-headers
			require.Equal(t, "86400", header.Get("TTL"))
			require.Equal(t, "high", header.Get("Urgency"))
			require.Empty(t, header.Get("Topic"), "通知显示标签不能折叠尚未投递的消息")
		})
	}
}

func TestDeliverHonorsRetryAfterWithinContextDeadline(t *testing.T) {
	privateKey, publicKey, err := webpushlib.GenerateVAPIDKeys()
	require.NoError(t, err)
	clientKey, err := ecdh.P256().GenerateKey(rand.Reader)
	require.NoError(t, err)
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
		w.Header().Set("Retry-After", "60")
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	err = NewSender(publicKey, privateKey, "mailto:push@example.com").Deliver(ctx, Subscription{
		Endpoint: server.URL + "/secret-endpoint",
		P256DH:   base64.RawURLEncoding.EncodeToString(clientKey.PublicKey().Bytes()),
		Auth:     base64.RawURLEncoding.EncodeToString(make([]byte, 16)),
	}, Notification{Title: "Test"})
	require.ErrorIs(t, err, context.DeadlineExceeded)
	require.EqualValues(t, 1, calls.Load())
	require.NotContains(t, err.Error(), "secret-endpoint")
}
