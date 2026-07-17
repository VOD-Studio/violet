// HTTP seam:供 CLI 下载/播放层构造带 netease 伪装头的请求。
// engine 内部请求走私有 transport;本 seam 是为流式下载(直链 mp3/flac CDN URL)
// 暴露的纯增量导出,不改 engine 任何现有行为。
package engine

import (
	"context"
	"fmt"
	"net/http"
)

// NewNeteaseRequest 构造一个带网易云伪装头(Referer / User-Agent / Cookie)的 HTTP 请求,
// 供流式下载或播放使用——调用方拿到 *http.Request 后自行 http.DefaultClient.Do(req),
// 从 resp.Body 流式读取音频(io.ReadCloser),不必经 engine 的 RawDo(后者返回完整 JSON)。
//
// cookie 处理与 engine 内部 setCommonHeaders 完全一致:
// 空 cookie 补 __remember_me=true;已含则不重复;否则追加。这三条是网易云返回正常 body 的前提。
//
// ctx 仅用于请求关联(超时/取消);URL 通常是 song url 接口返回的 CDN 直链。
func NewNeteaseRequest(ctx context.Context, method, url, cookie string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, method, url, nil)
	if err != nil {
		return nil, fmt.Errorf("构造 netease 请求: %w", err)
	}
	setCommonHeaders(req, cookie)
	return req, nil
}
