// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	newmodel "blog-api/internal/infrastructure/persistence/gorm/model"
)

// B站表情 API 常量
const (
	bilibiliUserAPIURL     = "https://api.bilibili.com/x/emote/user/panel/web?business=reply&web_location=333.1369"
	bilibiliOfficialAPIURL = "https://api.bilibili.com/x/emote/setting/panel?business=reply"
)

// BilibiliEmojiAPIResponse B站表情 API 响应结构
type BilibiliEmojiAPIResponse struct {
	Code int               `json:"code"`
	Data BilibiliEmojiData `json:"data"`
	Msg  string            `json:"message"`
}

// BilibiliEmojiData B站表情数据（兼容两种 API）
type BilibiliEmojiData struct {
	Packages          []BilibiliEmojiPackage `json:"packages"`            // 用户 API
	UserPanelPackages []BilibiliEmojiPackage `json:"user_panel_packages"` // 官方 API
}

// BilibiliEmojiPackage B站表情包
type BilibiliEmojiPackage struct {
	ID    int             `json:"id"`
	Text  string          `json:"text"`
	Emote []BilibiliEmote `json:"emote"`
	Type  int             `json:"type"` // 13=收藏特殊包，1=普通表情包
}

// BilibiliEmote B站单个表情
type BilibiliEmote struct {
	Text   string `json:"text"`
	URL    string `json:"url"`
	GifURL string `json:"gif_url"`
}

// SeedResult 种子数据导入结果
type SeedResult struct {
	GroupsCreated int
	EmojisCreated int
}

// EmojiSeedService 表情种子数据服务
type EmojiSeedService struct {
	db             *gorm.DB // GORM 直接操作（替代 sqlc queries）
	emojiDir       string   // 表情独立存储目录
	urlPrefix      string   // 上传 URL 前缀，如 "/uploads/"
	bilibiliCookie string   // B站登录 Cookie
	apiType        string   // API 类型：user 或 official
}

// NewEmojiSeedService 创建表情种子数据服务实例。
// emojiDir 为物理存储目录，urlPrefix 为 URL 前缀，二者解耦（不互推）。
func NewEmojiSeedService(db *gorm.DB, emojiDir, urlPrefix, cookie, apiType string) *EmojiSeedService {
	return &EmojiSeedService{
		db:             db,
		emojiDir:       emojiDir,
		urlPrefix:      urlPrefix,
		bilibiliCookie: cookie,
		apiType:        apiType,
	}
}

// SeedBilibiliEmojis 从 B站 API 获取表情数据并写入数据库作为初始种子数据
func (s *EmojiSeedService) SeedBilibiliEmojis(ctx context.Context) error {
	log.Info().Str("service", "EmojiSeedService").Str("operation", "SeedBilibiliEmojis").Msg("开始获取B站表情种子数据")

	// 调用 B站 API
	log.Info().Str("target", "BilibiliAPI").Msg("调用B站表情API")
	packages, err := s.fetchBilibiliEmojis()
	if err != nil {
		log.Warn().Err(err).Msg("获取B站表情失败（不影响服务启动）")
		return err
	}

	log.Info().Int("packages", len(packages)).Msg("获取到表情包组")

	// 写入数据库
	result, err := s.importBilibiliEmojis(ctx, packages)
	if err != nil {
		log.Warn().Err(err).Msg("写入B站表情失败（不影响服务启动）")
		return err
	}

	log.Info().Int("groups", result.GroupsCreated).Int("emojis", result.EmojisCreated).Msg("B站表情种子数据初始化完成")
	return nil
}

// fetchBilibiliEmojis 从 B站 API 获取表情数据
func (s *EmojiSeedService) fetchBilibiliEmojis() ([]BilibiliEmojiPackage, error) {
	if s.bilibiliCookie == "" {
		return nil, fmt.Errorf("未设置 B站 Cookie，请在环境变量中配置 BILIBILI_SESSDATA、BILIBILI_BILI_JCT、BILIBILI_DEDEUSERID")
	}

	// 选择 API URL
	var apiURL string
	switch s.apiType {
	case "user":
		apiURL = bilibiliUserAPIURL
		log.Info().Str("api", "user").Msg("使用用户收藏表情 API")
	case "official":
		apiURL = bilibiliOfficialAPIURL
		log.Info().Str("api", "official").Msg("使用官方表情 API")
	default:
		apiURL = bilibiliUserAPIURL
		log.Info().Str("api", "user").Msg("默认使用用户收藏表情 API")
	}

	client := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Referer", "https://www.bilibili.com")
	if s.bilibiliCookie != "" {
		req.Header.Set("Cookie", s.bilibiliCookie)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	var apiResp BilibiliEmojiAPIResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	if apiResp.Code != 0 {
		return nil, fmt.Errorf("API 错误: code=%d, msg=%s", apiResp.Code, apiResp.Msg)
	}

	// 兼容两种 API 的数据结构
	packages := apiResp.Data.Packages
	if len(packages) == 0 && len(apiResp.Data.UserPanelPackages) > 0 {
		packages = apiResp.Data.UserPanelPackages
	}

	// 过滤掉特殊包（type=13 是收藏包）
	var validPackages []BilibiliEmojiPackage
	for _, pkg := range packages {
		if pkg.Type == 13 || len(pkg.Emote) == 0 {
			continue
		}
		validPackages = append(validPackages, pkg)
	}

	return validPackages, nil
}

// importBilibiliEmojis 导入 B站表情数据到数据库
func (s *EmojiSeedService) importBilibiliEmojis(ctx context.Context, packages []BilibiliEmojiPackage) (*SeedResult, error) {
	result := &SeedResult{}

	// 确保表情目录存在
	if err := os.MkdirAll(s.emojiDir, 0755); err != nil {
		return nil, fmt.Errorf("创建表情目录失败: %w", err)
	}

	for i, pkg := range packages {
		if pkg.Text == "" || len(pkg.Emote) == 0 {
			continue
		}

		// 创建分组
		group := newmodel.EmojiGroup{
			Name:      pkg.Text,
			Source:    "bilibili",
			SortOrder: i + 1,
			IsEnabled: true,
		}

		if err := s.db.WithContext(ctx).Create(&group).Error; err != nil {
			log.Printf("警告: 创建表情分组 %s 失败: %v", pkg.Text, err)
			continue
		}
		result.GroupsCreated++

		// 创建表情（并发下载图片）
		for j, emote := range pkg.Emote {
			if emote.Text == "" {
				continue
			}

			// 判断是否为颜文字（纯文本表情）
			isTextEmoji := emote.URL == "" || emote.URL == emote.Text

			var urlValue, gifUrlValue, sourceUrlValue string

			if isTextEmoji {
				urlValue = emote.Text
				gifUrlValue = ""
				sourceUrlValue = ""
				log.Printf("检测到颜文字: %s，直接存储到 url 字段", emote.Text)
			} else {
				localStaticPath, err := s.downloadEmojiImage(emote.URL)
				if err != nil {
					log.Printf("警告: 下载表情 %s 静态图失败: %v", emote.Text, err)
					continue
				}
				urlValue = localStaticPath
				sourceUrlValue = emote.URL

				if emote.GifURL != "" {
					localGifPath, err := s.downloadEmojiImage(emote.GifURL)
					if err != nil {
						log.Printf("警告: 下载表情 %s 动图失败（已有静态图）: %v", emote.Text, err)
					} else {
						gifUrlValue = localGifPath
						log.Printf("表情 %s 下载动图: %s", emote.Text, localGifPath)
					}
				}
			}

			emoji := newmodel.Emoji{
				GroupID:     group.ID,
				Name:        emote.Text,
				URL:         urlValue,
				GifURL:      gifUrlValue,
				SourceURL:   sourceUrlValue,
				SortOrder:   j + 1,
			}

			if err := s.db.WithContext(ctx).Create(&emoji).Error; err != nil {
				log.Printf("警告: 创建表情 %s 失败: %v", emote.Text, err)
				continue
			}
			result.EmojisCreated++
		}
	}

	return result, nil
}

// downloadEmojiImage 下载表情图片到本地存储
func (s *EmojiSeedService) downloadEmojiImage(url string) (string, error) {
	client := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", fmt.Errorf("创建下载请求失败: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Referer", "https://www.bilibili.com")

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("下载失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("下载失败: status=%d", resp.StatusCode)
	}

	// 从 URL 或 Content-Type 推断扩展名
	ext := ".png"
	if strings.Contains(url, ".gif") {
		ext = ".gif"
	} else if ct := resp.Header.Get("Content-Type"); ct != "" {
		switch ct {
		case "image/gif":
			ext = ".gif"
		case "image/jpeg", "image/jpg":
			ext = ".jpg"
		case "image/webp":
			ext = ".webp"
		}
	}

	// 生成唯一文件名
	filename := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	dstPath := filepath.Join(s.emojiDir, filename)

	// 保存文件
	dst, err := os.Create(dstPath)
	if err != nil {
		return "", fmt.Errorf("创建文件失败: %w", err)
	}
	defer dst.Close()

	if _, err = io.Copy(dst, resp.Body); err != nil {
		os.Remove(dstPath)
		return "", fmt.Errorf("保存文件失败: %w", err)
	}

	// URL 从 urlPrefix 派生，与物理目录解耦
	return s.urlPrefix + "emojis/" + filename, nil
}
