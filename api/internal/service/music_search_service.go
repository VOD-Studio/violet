// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// MusicSearchService 音乐搜索服务
// 多源 API 实现：api.vkeys.cn（网易云搜索/歌词）+ api.qijieya.cn（Meting fallback）
type MusicSearchService struct {
	client *http.Client
}

// NewMusicSearchService 创建音乐搜索服务
func NewMusicSearchService() *MusicSearchService {
	return &MusicSearchService{
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// SearchResult 搜索结果
type SearchResult struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Artist   string `json:"artist"`
	Album    string `json:"album"`
	Cover    string `json:"cover"`
	Platform string `json:"platform"`
	URL      string `json:"url"`
	Lrc      string `json:"lrc"`
}

// SearchSongs 搜索歌曲（网易云）
func (s *MusicSearchService) SearchSongs(keyword string, limit int) ([]SearchResult, error) {
	log.Info().Str("service", "MusicSearchService").Str("operation", "SearchSongs").
		Str("keyword", keyword).Int("limit", limit).Msg("开始搜索歌曲")

	if limit <= 0 {
		limit = 10
	}

	// 尝试 vkeys API（返回结构化结果，含歌曲 ID 和封面）
	log.Info().Str("target", "VkeysAPI").Msg("调用vkeys搜索API")
	results, err := s.searchViaVkeys(keyword, limit)
	if err != nil {
		log.Warn().Err(err).Msg("vkeys API失败，尝试meting fallback")
		return s.searchViaMeting(keyword, limit)
	}
	log.Info().Int("count", len(results)).Msg("歌曲搜索成功")
	return results, nil
}

// FetchLyrics 获取歌词
func (s *MusicSearchService) FetchLyrics(platform, songID string) (string, error) {
	log.Info().Str("service", "MusicSearchService").Str("operation", "FetchLyrics").
		Str("platform", platform).Str("song_id", songID).Msg("开始获取歌词")

	// vkeys 歌词 API（网易云）
	if platform == "netease" || platform == "" {
		log.Info().Str("target", "VkeysAPI").Msg("调用vkeys歌词API")
		lrc, err := s.fetchLyricsViaVkeys(songID)
		if err != nil {
			log.Warn().Err(err).Msg("vkeys失败，尝试meting")
			return s.fetchLyricsViaMeting(platform, songID)
		}
		log.Info().Msg("歌词获取成功")
		return lrc, nil
	}
	log.Info().Str("target", "MetingAPI").Msg("调用meting歌词API")
	return s.fetchLyricsViaMeting(platform, songID)
}

// FetchSongDetail 获取歌曲详情（含封面和歌词）
func (s *MusicSearchService) FetchSongDetail(platform, songID string) (*SearchResult, error) {
	log.Info().Str("service", "MusicSearchService").Str("operation", "FetchSongDetail").
		Str("platform", platform).Str("song_id", songID).Msg("开始获取歌曲详情")

	// 优先用 qijieya Meting（返回完整信息）
	log.Info().Str("target", "QijieyaAPI").Msg("调用qijieya Meting API")
	detail, err := s.fetchDetailViaMeting("https://api.qijieya.cn/meting/", platform, songID)
	if err != nil {
		log.Warn().Err(err).Msg("qijieya失败，尝试injahow")
		detail, err = s.fetchDetailViaMeting("https://api.injahow.cn/meting/", platform, songID)
		if err != nil {
			log.Error().Err(err).Msg("获取歌曲详情失败")
			return nil, fmt.Errorf("获取歌曲详情失败: %w", err)
		}
	}
	log.Info().Str("title", detail.Title).Msg("歌曲详情获取成功")
	return detail, nil
}

// --- vkeys API（网易云搜索 + 歌词）---

func (s *MusicSearchService) searchViaVkeys(keyword string, limit int) ([]SearchResult, error) {
	apiURL := fmt.Sprintf("https://api.vkeys.cn/v2/music/netease?word=%s&page=1&num=%d",
		url.QueryEscape(keyword), limit)

	body, err := s.httpGetJSON(apiURL)
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

	results := make([]SearchResult, 0, len(resp.Data))
	for _, r := range resp.Data {
		results = append(results, SearchResult{
			ID:       fmt.Sprintf("%d", r.ID),
			Title:    r.Song,
			Artist:   r.Singer,
			Album:    r.Album,
			Cover:    ensureHTTPS(r.Cover),
			Platform: "netease",
		})
	}
	return results, nil
}

func (s *MusicSearchService) fetchLyricsViaVkeys(songID string) (string, error) {
	apiURL := fmt.Sprintf("https://api.vkeys.cn/v2/music/netease/lyric?id=%s", url.QueryEscape(songID))

	body, err := s.httpGetJSON(apiURL)
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

	lrc := resp.Data.Lrc
	// 清理：去掉逐字歌词标记，只保留标准 LRC
	lrc = cleanLRC(lrc)
	return strings.TrimSpace(lrc), nil
}

// --- Meting API（通用 fallback）---

func (s *MusicSearchService) searchViaMeting(keyword string, limit int) ([]SearchResult, error) {
	apiURL := fmt.Sprintf("https://api.qijieya.cn/meting/?server=netease&type=search&id=%s&limit=%d", url.QueryEscape(keyword), limit)

	body, err := s.httpGetBytes(apiURL)
	if err != nil {
		return nil, err
	}

	// 检查是否返回了错误对象
	if isMetingError(body) {
		// 尝试 injahow fallback
		fallbackURL := fmt.Sprintf("https://api.injahow.cn/meting/?server=netease&type=search&id=%s&limit=%d", url.QueryEscape(keyword), limit)
		body, err = s.httpGetBytes(fallbackURL)
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

	results := make([]SearchResult, 0, len(raw))
	for _, r := range raw {
		results = append(results, SearchResult{
			ID:       r.ID,
			Title:    r.Title,
			Artist:   r.Artist,
			Album:    r.Album,
			Cover:    ensureHTTPS(r.Cover),
			Platform: "netease",
			URL:      r.URL,
			Lrc:      r.Lrc,
		})
	}
	return results, nil
}

func (s *MusicSearchService) fetchLyricsViaMeting(platform, songID string) (string, error) {
	apiURL := fmt.Sprintf("https://api.qijieya.cn/meting/?server=%s&type=lrc&id=%s", platform, url.QueryEscape(songID))

	body, err := s.httpGetBytes(apiURL)
	if err != nil {
		return "", err
	}

	lrc := string(body)
	// Meting 可能返回歌词 URL 而非文本
	if strings.HasPrefix(strings.TrimSpace(lrc), "http") {
		body, err = s.httpGetBytes(strings.TrimSpace(lrc))
		if err != nil {
			return "", fmt.Errorf("获取歌词内容失败: %w", err)
		}
		lrc = string(body)
	}

	return strings.TrimSpace(lrc), nil
}

func (s *MusicSearchService) fetchDetailViaMeting(baseURL, platform, songID string) (*SearchResult, error) {
	apiURL := fmt.Sprintf("%s?server=%s&type=song&id=%s", baseURL, platform, url.QueryEscape(songID))

	body, err := s.httpGetBytes(apiURL)
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
	result := &SearchResult{
		ID:       r.ID,
		Title:    r.Title,
		Artist:   r.Artist,
		Album:    r.Album,
		Cover:    ensureHTTPS(r.Cover),
		Platform: platform,
		URL:      r.URL,
	}

	// 获取歌词文本（lrc 可能是 URL）
	if r.Lrc != "" {
		if strings.HasPrefix(r.Lrc, "http") {
			lrcBody, lrcErr := s.httpGetBytes(r.Lrc)
			if lrcErr == nil {
				result.Lrc = strings.TrimSpace(string(lrcBody))
			}
		} else {
			result.Lrc = r.Lrc
		}
	}

	return result, nil
}

// --- HTTP helpers ---

func (s *MusicSearchService) httpGetJSON(url string) ([]byte, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}
	return body, nil
}

func (s *MusicSearchService) httpGetBytes(url string) ([]byte, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}
	return body, nil
}

// --- Utility ---

// isMetingError 检查 Meting API 是否返回了错误（如限流）
func isMetingError(body []byte) bool {
	var errResp struct {
		Message string `json:"message"`
		Code    int    `json:"code"`
	}
	if json.Unmarshal(body, &errResp) == nil && errResp.Message != "" {
		return true
	}
	// 空数组也视为错误
	return string(body) == "[]" || string(body) == ""
}

// ensureHTTPS 将 http:// 图片链接转为 https://
func ensureHTTPS(url string) string {
	if strings.HasPrefix(url, "http://") {
		return "https://" + url[7:]
	}
	return url
}

// cleanLRC 从 vkeys 逐字歌词中提取标准 LRC
// vkeys 的 yrc 格式: [offset,duration](word_offset,word_duration,flag)词...
// 标准 LRC: [mm:ss.xx]歌词
func cleanLRC(lrc string) string {
	if lrc == "" {
		return ""
	}

	// 检查是否已经是标准 LRC 格式
	if strings.Contains(lrc, "[00:") && !strings.Contains(lrc, "(") {
		return lrc
	}

	// 如果包含逐字歌词标记（括号+逗号），尝试提取纯文本
	// 简单方案：按行处理，只保留 [timestamp] 后的文本
	lines := strings.Split(lrc, "\n")
	var result []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// 匹配标准 LRC 时间标签 [mm:ss.xx] 或 [offset,duration]
		// 如果是逐字格式 [12345,678](...)词，提取纯文本
		if idx := strings.Index(line, "]"); idx >= 0 {
			timeTag := line[:idx+1]
			text := line[idx+1:]

			// 跳过逐字歌词标记 (... 词...) 格式
			if strings.Contains(text, "(") && strings.Contains(text, ")") {
				// 提取括号外的文字
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

			// 如果时间标签是标准格式 [mm:ss.xx]，保留
			if isStandardLRCTime(timeTag) {
				result = append(result, timeTag+strings.TrimSpace(text))
			}
			// 非标准时间标签（如 [-500,500]）跳过该行
		}
	}

	if len(result) == 0 {
		return lrc // fallback 返回原始内容
	}
	return strings.Join(result, "\n")
}

// isStandardLRCTime 检查是否是标准 LRC 时间标签 [mm:ss.xx]
func isStandardLRCTime(tag string) bool {
	// tag 格式: [xx:xx.xx] 或 [xx:xx]
	if len(tag) < 4 {
		return false
	}
	content := tag[1 : len(tag)-1] // 去掉 []
	// 标准格式包含冒号，不包含逗号
	return strings.Contains(content, ":") && !strings.Contains(content, ",")
}
