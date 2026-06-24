// Package music 提供音乐解析的基础设施适配器。
//
// 实现 domain/music.MusicProvider 端口，封装网易云音乐和 QQ 音乐的
// 链接解析、搜索、歌词获取、详情查询能力。
// 多源 API 实现：api.vkeys.cn（网易云搜索/歌词）+ api.qijieya.cn（Meting fallback）。
package music

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	domainmusic "blog-api/internal/domain/music"
	"blog-api/internal/domain/shared"
)

// Provider 音乐解析适配器（实现 domain/music.MusicProvider）
type Provider struct {
	client *http.Client
}

// NewProvider 创建音乐解析适配器。
// 使用带 SSRF 拨号校验的 http.Transport：在 DialContext 实际解析到 IP 后
// 立即校验（防 DNS-rebinding：safeURL 预检与拨号二次解析之间存在 TOCTOU 窗口，
// 在拨号时刻校验则彻底关闭该窗口）。
func NewProvider() *Provider {
	dialer := &net.Dialer{Timeout: 5 * time.Second}
	tr := &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(addr)
			if err != nil {
				return nil, fmt.Errorf("解析拨号地址失败: %w", err)
			}
			// 解析主机名，逐 IP 校验是否为内网/回环/保留段
			ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
			if err != nil {
				return nil, fmt.Errorf("拨号前解析主机失败: %w", err)
			}
			for _, ip := range ips {
				if err := assertSafeIP(ip.IP); err != nil {
					return nil, err
				}
			}
			// 校验通过后，用第一解析结果拨号（避免二次解析被 rebind）
			if len(ips) == 0 {
				return nil, fmt.Errorf("主机 %s 未解析到 IP", host)
			}
			return dialer.DialContext(ctx, network, net.JoinHostPort(ips[0].IP.String(), port))
		},
	}
	return &Provider{client: &http.Client{Timeout: 10 * time.Second, Transport: tr}}
}

// ParseEmbedURL 解析音乐链接返回嵌入信息
func (p *Provider) ParseEmbedURL(rawURL string) (domainmusic.EmbedInfo, error) {
	if songID := parseNeteaseSongID(rawURL); songID != "" {
		return domainmusic.EmbedInfo{
			Platform: "netease",
			SongID:   songID,
			EmbedURL: "https://music.163.com/outchain/player?type=2&id=" + songID + "&auto=0&height=66",
		}, nil
	}
	if songID := parseQQMusicSongID(rawURL); songID != "" {
		return domainmusic.EmbedInfo{
			Platform: "tencent",
			SongID:   songID,
			EmbedURL: "https://i.y.qq.com/nryyun/song/" + songID,
		}, nil
	}
	return domainmusic.EmbedInfo{}, domainmusic.ErrUnsupportedMusicURL
}

// Search 搜索歌曲
func (p *Provider) Search(keyword string, limit int) ([]domainmusic.Song, error) {
	if limit <= 0 {
		limit = 10
	}
	results, err := p.searchViaVkeys(keyword, limit)
	if err != nil {
		log.Warn().Err(err).Msg("vkeys API 失败，尝试 meting fallback")
		results, err = p.searchViaMeting(keyword, limit)
		if err != nil {
			return nil, shared.Internal("音乐搜索失败", err)
		}
	}
	songs := make([]domainmusic.Song, 0, len(results))
	for _, r := range results {
		songs = append(songs, domainmusic.Song{
			Name: r.Title, Artist: r.Artist, URL: r.URL, Cover: r.Cover,
		})
	}
	return songs, nil
}

// FetchLyrics 获取歌词
func (p *Provider) FetchLyrics(platform, songID string) (string, error) {
	if platform == "netease" || platform == "" {
		lrc, err := p.fetchLyricsViaVkeys(songID)
		if err != nil {
			log.Warn().Err(err).Msg("vkeys 失败，尝试 meting")
			return p.fetchLyricsViaMeting(platform, songID)
		}
		return lrc, nil
	}
	return p.fetchLyricsViaMeting(platform, songID)
}

// FetchSongDetail 获取歌曲详情
func (p *Provider) FetchSongDetail(platform, songID string) (*domainmusic.Song, error) {
	detail, err := p.fetchDetailViaMeting("https://api.qijieya.cn/meting/", platform, songID)
	if err != nil {
		log.Warn().Err(err).Msg("qijieya 失败，尝试 injahow")
		detail, err = p.fetchDetailViaMeting("https://api.injahow.cn/meting/", platform, songID)
		if err != nil {
			return nil, shared.Internal("获取歌曲详情失败", err)
		}
	}
	return &domainmusic.Song{
		Name: detail.Title, Artist: detail.Artist, URL: detail.URL, Cover: detail.Cover,
	}, nil
}

// FetchSongMeta 获取歌曲元数据（封面+歌词）
func (p *Provider) FetchSongMeta(platform, songID string) (*domainmusic.SongMeta, error) {
	detail, err := p.fetchDetailViaMeting("https://api.qijieya.cn/meting/", platform, songID)
	if err != nil {
		detail, err = p.fetchDetailViaMeting("https://api.injahow.cn/meting/", platform, songID)
		if err != nil {
			return nil, shared.Internal("获取歌曲元数据失败", err)
		}
	}
	return &domainmusic.SongMeta{Cover: detail.Cover, Lyrics: detail.Lrc}, nil
}

// FetchPlaylist 解析歌单链接返回歌曲列表（当前实现返回单歌曲嵌入信息占位）
func (p *Provider) FetchPlaylist(rawURL string) (*domainmusic.PlaylistMeta, error) {
	info, err := p.ParseEmbedURL(rawURL)
	if err != nil {
		return nil, err
	}
	detail, derr := p.FetchSongDetail(info.Platform, info.SongID)
	songs := []domainmusic.Song{}
	if derr == nil && detail != nil {
		songs = append(songs, *detail)
	}
	return &domainmusic.PlaylistMeta{
		Platform: info.Platform, PlaylistID: info.SongID, Songs: songs,
	}, nil
}

// 编译期断言
var _ domainmusic.MusicProvider = (*Provider)(nil)

// ============================================================
// 内部搜索结果结构
// ============================================================

type searchResult struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Artist   string `json:"artist"`
	Album    string `json:"album"`
	Cover    string `json:"cover"`
	Platform string `json:"platform"`
	URL      string `json:"url"`
	Lrc      string `json:"lrc"`
}

// ============================================================
// vkeys API（网易云搜索 + 歌词）
// ============================================================

func (p *Provider) searchViaVkeys(keyword string, limit int) ([]searchResult, error) {
	apiURL := fmt.Sprintf("https://api.vkeys.cn/v2/music/netease?word=%s&page=1&num=%d",
		url.QueryEscape(keyword), limit)
	body, err := p.httpGet(apiURL)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Code int `json:"code"`
		Data []struct {
			ID     int64  `json:"id"`
			Song   string `json:"song"`
			Singer string `json:"singer"`
			Album  string `json:"album"`
			Cover  string `json:"cover"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("解析 vkeys 搜索结果失败: %w", err)
	}
	if resp.Code != 200 {
		return nil, fmt.Errorf("vkeys API 返回错误码: %d", resp.Code)
	}
	results := make([]searchResult, 0, len(resp.Data))
	for _, r := range resp.Data {
		results = append(results, searchResult{
			ID: fmt.Sprintf("%d", r.ID), Title: r.Song, Artist: r.Singer,
			Album: r.Album, Cover: ensureHTTPS(r.Cover), Platform: "netease",
		})
	}
	return results, nil
}

func (p *Provider) fetchLyricsViaVkeys(songID string) (string, error) {
	apiURL := fmt.Sprintf("https://api.vkeys.cn/v2/music/netease/lyric?id=%s", url.QueryEscape(songID))
	body, err := p.httpGet(apiURL)
	if err != nil {
		return "", err
	}
	var resp struct {
		Code int `json:"code"`
		Data struct {
			Lrc string `json:"lrc"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return "", fmt.Errorf("解析歌词失败: %w", err)
	}
	if resp.Code != 200 {
		return "", fmt.Errorf("vkeys 歌词 API 返回错误码: %d", resp.Code)
	}
	return strings.TrimSpace(cleanLRC(resp.Data.Lrc)), nil
}

// ============================================================
// Meting API（通用 fallback）
// ============================================================

func (p *Provider) searchViaMeting(keyword string, limit int) ([]searchResult, error) {
	apiURL := fmt.Sprintf("https://api.qijieya.cn/meting/?server=netease&type=search&id=%s&limit=%d", url.QueryEscape(keyword), limit)
	body, err := p.httpGet(apiURL)
	if err != nil {
		return nil, err
	}
	if isMetingError(body) {
		fallbackURL := fmt.Sprintf("https://api.injahow.cn/meting/?server=netease&type=search&id=%s&limit=%d", url.QueryEscape(keyword), limit)
		body, err = p.httpGet(fallbackURL)
		if err != nil {
			return nil, err
		}
		if isMetingError(body) {
			return nil, fmt.Errorf("音乐搜索服务暂不可用")
		}
	}
	var raw []struct {
		ID     string `json:"id"`
		Title  string `json:"name"`
		Artist string `json:"artist"`
		Album  string `json:"album"`
		Cover  string `json:"pic"`
		URL    string `json:"url"`
		Lrc    string `json:"lrc"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("解析搜索结果失败: %w", err)
	}
	results := make([]searchResult, 0, len(raw))
	for _, r := range raw {
		results = append(results, searchResult{
			ID: r.ID, Title: r.Title, Artist: r.Artist, Album: r.Album,
			Cover: ensureHTTPS(r.Cover), Platform: "netease", URL: r.URL, Lrc: r.Lrc,
		})
	}
	return results, nil
}

func (p *Provider) fetchLyricsViaMeting(platform, songID string) (string, error) {
	apiURL := fmt.Sprintf("https://api.qijieya.cn/meting/?server=%s&type=lrc&id=%s", platform, url.QueryEscape(songID))
	body, err := p.httpGet(apiURL)
	if err != nil {
		return "", err
	}
	lrc := string(body)
	if strings.HasPrefix(strings.TrimSpace(lrc), "http") {
		target := strings.TrimSpace(lrc)
		// 二次请求目标由上游返回，必须显式校验防 SSRF
		if err := safeURL(target); err != nil {
			return "", fmt.Errorf("歌词重定向目标不安全: %w", err)
		}
		body, err = p.httpGet(target)
		if err != nil {
			return "", fmt.Errorf("获取歌词内容失败: %w", err)
		}
		lrc = string(body)
	}
	return strings.TrimSpace(lrc), nil
}

func (p *Provider) fetchDetailViaMeting(baseURL, platform, songID string) (*searchResult, error) {
	apiURL := fmt.Sprintf("%s?server=%s&type=song&id=%s", baseURL, platform, url.QueryEscape(songID))
	body, err := p.httpGet(apiURL)
	if err != nil {
		return nil, err
	}
	if isMetingError(body) {
		return nil, fmt.Errorf("Meting API 返回错误")
	}
	var raw []struct {
		ID     string `json:"id"`
		Title  string `json:"name"`
		Artist string `json:"artist"`
		Album  string `json:"album"`
		Cover  string `json:"pic"`
		URL    string `json:"url"`
		Lrc    string `json:"lrc"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("解析歌曲详情失败: %w", err)
	}
	if len(raw) == 0 {
		return nil, fmt.Errorf("未找到歌曲")
	}
	r := raw[0]
	result := &searchResult{
		ID: r.ID, Title: r.Title, Artist: r.Artist, Album: r.Album,
		Cover: ensureHTTPS(r.Cover), Platform: platform, URL: r.URL,
	}
	if r.Lrc != "" {
		if strings.HasPrefix(r.Lrc, "http") {
			// 歌词 URL 由上游返回，显式校验防 SSRF
			if err := safeURL(r.Lrc); err == nil {
				if lrcBody, lrcErr := p.httpGet(r.Lrc); lrcErr == nil {
					result.Lrc = strings.TrimSpace(string(lrcBody))
				}
			}
		} else {
			result.Lrc = r.Lrc
		}
	}
	return result, nil
}

// ============================================================
// HTTP helper
// ============================================================

func (p *Provider) httpGet(target string) ([]byte, error) {
	// SSRF 防护：拒绝非 http(s) 与内网/回环/链路本地地址
	if err := safeURL(target); err != nil {
		return nil, fmt.Errorf("请求目标不安全: %w", err)
	}
	req, err := http.NewRequest("GET", target, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("上游返回 %d", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}
	return body, nil
}

// safeURL 预检目标 URL 是否安全（第一道防线：拒绝非 http(s)/空主机）。
// 真正的 IP 校验由 NewProvider 的 DialContext 在拨号时刻完成，防 DNS-rebinding TOCTOU。
// 此处保留 DNS 预检以便提前给出清晰错误、并在 DialContext 之外的场景（如直接构造）兜底。
func safeURL(rawURL string) error {
	if rawURL == "" {
		return fmt.Errorf("URL 为空")
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("解析 URL 失败: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("不允许的协议: %s", u.Scheme)
	}
	host := u.Hostname()
	if host == "" {
		return fmt.Errorf("URL 缺少主机名")
	}
	ips, err := net.LookupIP(host)
	if err != nil {
		return fmt.Errorf("解析主机 IP 失败: %w", err)
	}
	for _, ip := range ips {
		if err := assertSafeIP(ip); err != nil {
			return err
		}
	}
	return nil
}

// assertSafeIP 校验单个 IP 不属于内网/回环/链路本地/未指定段。
// 供 safeURL 预检与 DialContext 拨号校验共用。
func assertSafeIP(ip net.IP) error {
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsUnspecified() {
		return fmt.Errorf("目标地址 %s 属于内网/保留段，拒绝访问", ip)
	}
	return nil
}

// ============================================================
// URL 解析（网易云/QQ 音乐歌曲 ID 提取）
// ============================================================

func parseNeteaseSongID(rawURL string) string {
	re := regexp.MustCompile(`music\.163\.com/(#/?song\?id=|song/)([0-9]+)`)
	if m := re.FindStringSubmatch(rawURL); len(m) >= 3 {
		return m[2]
	}
	re2 := regexp.MustCompile(`music\.163\.com.*[?&]id=([0-9]+)`)
	if m := re2.FindStringSubmatch(rawURL); len(m) >= 2 {
		return m[1]
	}
	return ""
}

func parseQQMusicSongID(rawURL string) string {
	if !strings.Contains(rawURL, "y.qq.com") {
		return ""
	}
	re := regexp.MustCompile(`/song(?:Detail)?/([a-zA-Z0-9]+)`)
	if m := re.FindStringSubmatch(rawURL); len(m) >= 2 {
		return m[1]
	}
	re2 := regexp.MustCompile(`[?&]song(?:id|mid)=([a-zA-Z0-9]+)`)
	if m := re2.FindStringSubmatch(rawURL); len(m) >= 2 {
		return m[1]
	}
	return ""
}

// ============================================================
// Utility
// ============================================================

func isMetingError(body []byte) bool {
	var errResp struct {
		Message string `json:"message"`
		Code    int    `json:"code"`
	}
	if json.Unmarshal(body, &errResp) == nil && errResp.Message != "" {
		return true
	}
	return string(body) == "[]" || string(body) == ""
}

func ensureHTTPS(rawURL string) string {
	if strings.HasPrefix(rawURL, "http://") {
		return "https://" + rawURL[7:]
	}
	return rawURL
}

func cleanLRC(lrc string) string {
	if lrc == "" {
		return ""
	}
	if strings.Contains(lrc, "[00:") && !strings.Contains(lrc, "(") {
		return lrc
	}
	lines := strings.Split(lrc, "\n")
	var result []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if idx := strings.Index(line, "]"); idx >= 0 {
			timeTag := line[:idx+1]
			text := line[idx+1:]
			if strings.Contains(text, "(") && strings.Contains(text, ")") {
				var cleanText strings.Builder
				inParen := false
				for _, ch := range text {
					if ch == '(' {
						inParen = true
						continue
					}
					if ch == ')' {
						inParen = false
						continue
					}
					if !inParen {
						cleanText.WriteRune(ch)
					}
				}
				text = cleanText.String()
			}
			if isStandardLRCTime(timeTag) {
				result = append(result, timeTag+strings.TrimSpace(text))
			}
		}
	}
	if len(result) == 0 {
		return lrc
	}
	return strings.Join(result, "\n")
}

func isStandardLRCTime(tag string) bool {
	if len(tag) < 4 {
		return false
	}
	content := tag[1 : len(tag)-1]
	return strings.Contains(content, ":") && !strings.Contains(content, ",")
}
