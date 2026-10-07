package xtweet

import (
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/net/http/httpproxy"
)

func TestSafeClientRoutesEachAllowedRequestUsingEnvironmentProxyPolicy(t *testing.T) {
	for _, proxy := range []string{"", "http://127.0.0.1:20172"} {
		t.Run(proxy, func(t *testing.T) {
			client := safeClient(nil, "pbs.twimg.com", "api.fxtwitter.com")
			transport := client.Transport.(*allowedTransport)
			policy := (&httpproxy.Config{HTTPSProxy: proxy, NoProxy: "api.fxtwitter.com"}).ProxyFunc()
			transport.proxy = func(req *http.Request) (*url.URL, error) { return policy(req.URL) }
			var direct, proxied []string
			transport.direct = roundTripFunc(func(req *http.Request) (*http.Response, error) {
				direct = append(direct, req.URL.Hostname())
				return jsonResponse(200, `{}`), nil
			})
			transport.proxied = roundTripFunc(func(req *http.Request) (*http.Response, error) {
				proxied = append(proxied, req.URL.Hostname())
				return jsonResponse(200, `{}`), nil
			})
			for _, host := range []string{"pbs.twimg.com", "api.fxtwitter.com"} {
				res, err := client.Get("https://" + host + "/fixture")
				require.NoError(t, err)
				require.NoError(t, res.Body.Close())
			}
			if proxy == "" {
				require.Equal(t, []string{"pbs.twimg.com", "api.fxtwitter.com"}, direct)
				require.Empty(t, proxied)
			} else {
				require.Equal(t, []string{"api.fxtwitter.com"}, direct)
				require.Equal(t, []string{"pbs.twimg.com"}, proxied)
			}
		})
	}
}

func TestSafeClientRejectsUnsafeTargetsBeforeEitherTransport(t *testing.T) {
	for _, target := range []string{
		"http://pbs.twimg.com/avatar.jpg", "https://user:secret@pbs.twimg.com/avatar.jpg",
		"https://pbs.twimg.com:8443/avatar.jpg", "https://evil.test/avatar.jpg",
		"https://127.0.0.1/avatar.jpg", "https://pbs.twimg.com.evil.test/avatar.jpg",
	} {
		t.Run(target, func(t *testing.T) {
			client := safeClient(nil, "pbs.twimg.com")
			transport := client.Transport.(*allowedTransport)
			transport.proxy = func(*http.Request) (*url.URL, error) { return url.Parse("http://127.0.0.1:20172") }
			blocked := roundTripFunc(func(*http.Request) (*http.Response, error) {
				t.Fatal("unsafe target reached network transport")
				return nil, nil
			})
			transport.direct, transport.proxied = blocked, blocked
			_, err := client.Get(target)
			require.Error(t, err)
		})
	}
}

func TestSafeClientRejectsUnsafeRedirectsWithProxy(t *testing.T) {
	for _, target := range []string{
		"http://pbs.twimg.com/avatar.jpg", "https://user:secret@pbs.twimg.com/avatar.jpg",
		"https://pbs.twimg.com:8443/avatar.jpg", "https://evil.test/avatar.jpg", "https://127.0.0.1/avatar.jpg",
	} {
		t.Run(target, func(t *testing.T) {
			client := safeClient(nil, "pbs.twimg.com")
			transport := client.Transport.(*allowedTransport)
			transport.proxy = func(*http.Request) (*url.URL, error) { return url.Parse("http://127.0.0.1:20172") }
			calls := 0
			transport.proxied = roundTripFunc(func(req *http.Request) (*http.Response, error) {
				calls++
				require.Equal(t, "https://pbs.twimg.com/start", req.URL.String())
				res := jsonResponse(http.StatusFound, `{}`)
				res.Header.Set("Location", target)
				return res, nil
			})
			_, err := client.Get("https://pbs.twimg.com/start")
			require.Error(t, err)
			require.Equal(t, 1, calls)
		})
	}
}
