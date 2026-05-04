// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"context"
	"database/sql"
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

	"blog-api/internal/repository/generated"
)

// B站表情 API 常量
const bilibiliEmojiAPIURL = "https://api.bilibili.com/x/emote/setting/panel?business=reply"

// BilibiliEmojiAPIResponse B站表情 API 响应结构
type BilibiliEmojiAPIResponse struct {
	Code int               `json:"code"`
	Data BilibiliEmojiData `json:"data"`
	Msg  string            `json:"message"`
}

// BilibiliEmojiData B站表情数据
type BilibiliEmojiData struct {
	Packages []BilibiliEmojiPackage `json:"user_panel_packages"`
}

// BilibiliEmojiPackage B站表情包
type BilibiliEmojiPackage struct {
	ID    int             `json:"id"`
	Text  string          `json:"text"`
	Emote []BilibiliEmote `json:"emote"`
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
	queries        *generated.Queries
	emojiDir       string // 表情独立存储目录
	bilibiliCookie string // B站登录 Cookie
}

// NewEmojiSeedService 创建表情种子数据服务实例
func NewEmojiSeedService(queries *generated.Queries, emojiDir, cookie string) *EmojiSeedService {
	return &EmojiSeedService{
		queries:        queries,
		emojiDir:       emojiDir,
		bilibiliCookie: cookie,
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

	client := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequest("GET", bilibiliEmojiAPIURL, nil)
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

	return apiResp.Data.Packages, nil
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
		groupParams := generated.CreateEmojiGroupParams{
			Name:      pkg.Text,
			Source:    "bilibili",
			SortOrder: int32(i + 1),
			IsEnabled: true,
		}

		group, err := s.queries.CreateEmojiGroup(ctx, groupParams)
		if err != nil {
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
			// 颜文字的特征：URL 为空或者 URL 就是表情文本本身
			isTextEmoji := emote.URL == "" || emote.URL == emote.Text

			var urlValue, gifUrlValue, sourceUrlValue string
			var err error

			if isTextEmoji {
				// 颜文字：url 字段直接存储表情文本
				urlValue = emote.Text
				gifUrlValue = ""
				sourceUrlValue = ""
				log.Printf("检测到颜文字: %s，直接存储到 url 字段", emote.Text)
			} else {
				// 图片表情：下载静态图
				localStaticPath, err := s.downloadEmojiImage(emote.URL)
				if err != nil {
					log.Printf("警告: 下载表情 %s 静态图失败: %v", emote.Text, err)
					continue
				}
				urlValue = localStaticPath
				sourceUrlValue = emote.URL

				// 如果有动图，也下载
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

			emojiParams := generated.CreateEmojiParams{
				GroupID:     group.ID,
				Name:        emote.Text,
				Url:         sql.NullString{String: urlValue, Valid: urlValue != ""},
				GifUrl:      sql.NullString{String: gifUrlValue, Valid: gifUrlValue != ""},
				SourceUrl:   sql.NullString{String: sourceUrlValue, Valid: sourceUrlValue != ""},
				TextContent: sql.NullString{String: "", Valid: false},
				SortOrder:   int32(j + 1),
			}

			_, err = s.queries.CreateEmoji(ctx, emojiParams)
			if err != nil {
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

	// 返回相对路径 URL
	return "/uploads/emojis/" + filename, nil
}
