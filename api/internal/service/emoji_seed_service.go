// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"context"
	"fmt"
	"os"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"blog-api/internal/infrastructure/bilibili"
	newmodel "blog-api/internal/infrastructure/persistence/gorm/model"
)

// SeedResult 种子数据导入结果
type SeedResult struct {
	GroupsCreated    int
	EmojisCreated    int
	CoversBackfilled int
}

// EmojiSeedService 表情种子数据服务
type EmojiSeedService struct {
	db         *gorm.DB             // GORM 直接操作（替代 sqlc queries）
	emojiDir   string               // 表情独立存储目录
	urlPrefix  string               // 上传 URL 前缀，如 "/uploads/"
	client     *bilibili.Client     // B站表情 API 客户端
	downloader *bilibili.Downloader // 表情图片下载器
	apiType    string               // API 类型：user 或 official
}

// NewEmojiSeedService 创建表情种子数据服务实例。
// emojiDir 为物理存储目录，urlPrefix 为 URL 前缀，二者解耦（不互推）。
func NewEmojiSeedService(db *gorm.DB, emojiDir, urlPrefix, cookie, apiType string) *EmojiSeedService {
	return &EmojiSeedService{
		db:         db,
		emojiDir:   emojiDir,
		urlPrefix:  urlPrefix,
		client:     bilibili.NewClient(cookie),
		downloader: bilibili.NewDownloader(emojiDir, urlPrefix),
		apiType:    apiType,
	}
}

// SeedBilibiliEmojis 从 B站 API 获取表情数据并写入数据库。
// 首次启动且无表情分组时执行完整导入；已有数据时仅对 bilibili 分组回填缺失的封面 URL。
func (s *EmojiSeedService) SeedBilibiliEmojis(ctx context.Context) error {
	log.Info().Str("service", "EmojiSeedService").Str("operation", "SeedBilibiliEmojis").Msg("开始获取B站表情种子数据")

	// 调用 B站 API
	log.Info().Str("target", "BilibiliAPI").Msg("调用B站表情API")
	packages, err := s.client.FetchEmojis(ctx, s.apiType)
	if err != nil {
		log.Warn().Err(err).Msg("获取B站表情失败（不影响服务启动）")
		return err
	}

	log.Info().Int("packages", len(packages)).Msg("获取到表情包组")

	var totalCount int64
	if err := s.db.WithContext(ctx).Model(&newmodel.EmojiGroup{}).Count(&totalCount).Error; err != nil {
		return fmt.Errorf("检查表情分组数量失败: %w", err)
	}

	var result *SeedResult
	if totalCount == 0 {
		result, err = s.importBilibiliEmojis(ctx, packages)
	} else {
		result, err = s.backfillBilibiliCovers(ctx, packages)
	}
	if err != nil {
		log.Warn().Err(err).Msg("写入B站表情失败（不影响服务启动）")
		return err
	}

	log.Info().
		Int("groups", result.GroupsCreated).
		Int("emojis", result.EmojisCreated).
		Int("covers_backfilled", result.CoversBackfilled).
		Msg("B站表情种子数据初始化完成")
	return nil
}

// importBilibiliEmojis 导入 B站表情数据到数据库
func (s *EmojiSeedService) importBilibiliEmojis(ctx context.Context, packages []bilibili.Package) (*SeedResult, error) {
	result := &SeedResult{}

	// 确保表情目录存在
	if err := os.MkdirAll(s.emojiDir, 0755); err != nil {
		return nil, fmt.Errorf("创建表情目录失败: %w", err)
	}

	for i, pkg := range packages {
		if pkg.Text == "" || len(pkg.Emote) == 0 {
			continue
		}

		// 封面下载到本地，避免 B站 nginx 反盗链导致前端无法显示
		coverURL, err := s.downloadCoverImage(ctx, pkg)
		if err != nil {
			log.Warn().Err(err).Str("group", pkg.Text).Msg("下载分组封面失败，将使用远程 URL 兜底")
			coverURL = bilibili.PackageCoverURL(pkg)
		}

		// 创建分组
		group := newmodel.EmojiGroup{
			Name:      pkg.Text,
			Source:    "bilibili",
			CoverURL:  coverURL,
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
				localStaticPath, err := s.downloader.Download(emote.URL)
				if err != nil {
					log.Printf("警告: 下载表情 %s 静态图失败: %v", emote.Text, err)
					continue
				}
				urlValue = localStaticPath
				sourceUrlValue = emote.URL

				if emote.GifURL != "" {
					localGifPath, err := s.downloader.Download(emote.GifURL)
					if err != nil {
						log.Printf("警告: 下载表情 %s 动图失败（已有静态图）: %v", emote.Text, err)
					} else {
						gifUrlValue = localGifPath
						log.Printf("表情 %s 下载动图: %s", emote.Text, localGifPath)
					}
				}
			}

			emoji := newmodel.Emoji{
				GroupID:   group.ID,
				Name:      emote.Text,
				URL:       urlValue,
				GifURL:    gifUrlValue,
				SourceURL: sourceUrlValue,
				SortOrder: j + 1,
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

// backfillBilibiliCovers 对已有 bilibili 分组回填缺失的封面 URL。
// 适用于服务重启时迁移历史数据，不会创建新分组或修改表情。
func (s *EmojiSeedService) backfillBilibiliCovers(ctx context.Context, packages []bilibili.Package) (*SeedResult, error) {
	result := &SeedResult{}

	coverByName := make(map[string]string, len(packages))
	for _, pkg := range packages {
		if pkg.Text == "" {
			continue
		}
		coverURL := bilibili.PackageCoverURL(pkg)
		if coverURL == "" {
			log.Warn().Str("group", pkg.Text).Msg("B站分组未返回可用封面")
			continue
		}
		coverByName[pkg.Text] = coverURL
	}

	var groups []newmodel.EmojiGroup
	if err := s.db.WithContext(ctx).
		Where("source = ? AND (cover_url IS NULL OR cover_url = '' OR cover_url LIKE 'http%')", "bilibili").
		Find(&groups).Error; err != nil {
		return nil, fmt.Errorf("查询待回填/替换远程封面分组失败: %w", err)
	}

	for _, g := range groups {
		coverURL, ok := coverByName[g.Name]
		if !ok {
			log.Warn().Str("group", g.Name).Msg("本地 bilibili 分组未在 B站 API 中匹配到封面")
			continue
		}

		log.Info().Str("group", g.Name).Str("remote_url", coverURL).Msg("开始下载分组封面")
		localCoverURL, err := s.downloader.Download(coverURL)
		if err != nil {
			log.Warn().Err(err).Str("group", g.Name).Str("remote_url", coverURL).Msg("下载封面失败，使用远程 URL")
			localCoverURL = coverURL
		} else {
			log.Info().Str("group", g.Name).Str("local_url", localCoverURL).Msg("分组封面下载完成")
		}

		if err := s.db.WithContext(ctx).
			Model(&newmodel.EmojiGroup{}).
			Where("id = ?", g.ID).
			Update("cover_url", localCoverURL).Error; err != nil {
			log.Printf("更新分组 %s 封面失败: %v", g.Name, err)
			continue
		}
		result.CoversBackfilled++
		log.Printf("已回填封面: %s", g.Name)
	}

	return result, nil
}

// downloadCoverImage 下载分组封面图到本地存储。
// 封面与表情共用 uploads/emojis/ 目录，返回本地可访问 URL。
func (s *EmojiSeedService) downloadCoverImage(ctx context.Context, pkg bilibili.Package) (string, error) {
	coverURL := bilibili.PackageCoverURL(pkg)
	if coverURL == "" {
		return "", fmt.Errorf("分组 %s 没有可用封面 URL", pkg.Text)
	}
	log.Info().Str("group", pkg.Text).Str("remote_url", coverURL).Msg("开始下载分组封面")
	localURL, err := s.downloader.Download(coverURL)
	if err != nil {
		return "", fmt.Errorf("下载分组 %s 封面失败: %w", pkg.Text, err)
	}
	log.Info().Str("group", pkg.Text).Str("local_url", localURL).Msg("分组封面下载完成")
	return localURL, nil
}
