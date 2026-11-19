package feed

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/mmcdole/gofeed"

	appsub "blog-api/internal/application/subscription"
	"blog-api/internal/infrastructure/ssrf"
)

// NewSafeClient 直连公开地址，每跳限制协议和目标，不读取环境或配置代理。
func NewSafeClient() *http.Client {
	transport := ssrf.NewSafeTransport()
	transport.Proxy = nil
	transport.MaxConnsPerHost = 2
	transport.ResponseHeaderTimeout = 5 * time.Second
	return &http.Client{
		Transport: transport,
		Timeout:   8 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) > 3 {
				return fmt.Errorf("外站重定向超过 3 次")
			}
			if _, err := ssrf.ValidateURL(req.URL.String()); err != nil {
				return err
			}
			if req.URL.User != nil {
				return fmt.Errorf("外站地址不允许包含凭据")
			}
			return ssrf.CheckHost(req.Context(), req.URL.Hostname(), nil)
		},
	}
}

// SafeGoFeedParser 共用连接池，每次解析持有独立 parser，允许后台并发抓取。
type SafeGoFeedParser struct {
	client *http.Client
}

// NewSafeGoFeedParser 不继承订阅代理策略。
func NewSafeGoFeedParser() *SafeGoFeedParser {
	return &SafeGoFeedParser{client: NewSafeClient()}
}

func (g *SafeGoFeedParser) Parse(ctx context.Context, feedURL string) (string, []appsub.FeedItem, error) {
	parser := GoFeedParser{client: g.client, parser: gofeed.NewParser()}
	return parser.Parse(ctx, feedURL)
}
