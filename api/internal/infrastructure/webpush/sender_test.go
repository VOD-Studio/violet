package webpush

import (
	"context"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

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
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(status)
			}))
			defer server.Close()
			sender := NewSender(publicKey, privateKey, "mailto:push@example.com")
			err := sender.Send(context.Background(), &domainchat.PushSubscription{
				Endpoint: server.URL,
				P256DH:   base64.RawURLEncoding.EncodeToString(clientKey.PublicKey().Bytes()),
				Auth:     base64.RawURLEncoding.EncodeToString(auth),
			}, appchat.PushPayload{Title: "Test", Tag: "violet-chat"})
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
