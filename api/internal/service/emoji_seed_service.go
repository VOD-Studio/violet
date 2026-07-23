// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"context"
	"fmt"
	"sort"
	"sync"

	"github.com/rs/zerolog/log"
	"golang.org/x/sync/errgroup"

	domainemoji "blog-api/internal/domain/emoji"
	"blog-api/internal/infrastructure/bilibili"
)

// SeedResult 种子数据导入结果
type SeedResult struct {
	GroupsCreated    int
	EmojisCreated    int
	CoversBackfilled int
}

// EmojiSeedService 表情种子数据服务
type EmojiSeedService struct {
	repo       domainemoji.EmojiGroupRepository
	emojiDir   string               // 表情独立存储目录
	client     *bilibili.Client     // B站表情 API 客户端
	downloader *bilibili.Downloader // 表情图片下载器
	apiType    string               // API 类型：user 或 official
}

// NewEmojiSeedService 创建表情种子数据服务实例。
// emojiDir 为物理存储目录，urlPrefix 为 URL 前缀，二者解耦（不互推）。
func NewEmojiSeedService(repo domainemoji.EmojiGroupRepository, emojiDir, urlPrefix, cookie, apiType string) *EmojiSeedService {
	return &EmojiSeedService{
		repo:       repo,
		emojiDir:   emojiDir,
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

	totalCount, err := s.repo.Count(ctx)
	if err != nil {
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
		g, err := domainemoji.NewEmojiGroup(0, pkg.Text, domainemoji.SourceBilibili)
		if err != nil {
			log.Printf("警告: 创建表情分组对象 %s 失败: %v", pkg.Text, err)
			continue
		}
		g.SetCoverURL(coverURL)
		g.SetSortOrder(i + 1)
		g.SetEnabled(true)
		groupID, err := s.repo.Save(ctx, g)
		if err != nil {
			log.Printf("警告: 创建表情分组 %s 失败: %v", pkg.Text, err)
			continue
		}
		result.GroupsCreated++

		// 并发下载当前包内所有表情图（复用公共方法）
		results := s.downloadPackageEmojis(ctx, pkg)

		// 第二阶段：按序串行写库
		for j, de := range results {
			domainEmoji := domainemoji.NewEmoji(0, groupID, de.emote.Text, de.url)
			domainEmoji.Update(de.emote.Text, de.url, "", de.gifURL, de.sourceURL, j+1)
			domainEmoji.SetMeta(emoteMetaToDomain(de.emote))
			if _, err := s.repo.SaveEmoji(ctx, domainEmoji); err != nil {
				log.Printf("警告: 创建表情 %s 失败: %v", de.emote.Text, err)
				continue
			}
			result.EmojisCreated++
		}
	}

	return result, nil
}

// downloadedEmoji 单个表情的下载结果（importBilibiliEmojis 和 ReseedBilibiliEmojis 共用）
type downloadedEmoji struct {
	emote     bilibili.Emote
	url       string // 本地路径，颜文字为文本本身
	gifURL    string
	sourceURL string
	sortOrder int // 原始 emote 在 pkg.Emote 中的序号（1-based），用于保持排序
}

// emoteMetaToDomain 将 B站 emote 的 meta 子对象与顶层 type 转为 domain EmojiMeta。
// B站字段映射：meta.alias→alias、meta.size→size、type→type。
func emoteMetaToDomain(e bilibili.Emote) domainemoji.EmojiMeta {
	return domainemoji.ReconstructEmojiMeta(
		e.Meta.Alias,
		domainemoji.EmojiSize(e.Meta.Size),
		domainemoji.EmojiType(e.Type),
	)
}

// downloadPackageEmojis 并发下载一个包内所有表情图（并发度 8），返回按原序排序的结果。
// 纯下载不写库，供 importBilibiliEmojis 和 ReseedBilibiliEmojis 复用。
func (s *EmojiSeedService) downloadPackageEmojis(ctx context.Context, pkg bilibili.Package) []downloadedEmoji {
	eg, _ := errgroup.WithContext(ctx)
	eg.SetLimit(8)
	var mu sync.Mutex
	results := make([]downloadedEmoji, 0, len(pkg.Emote))

	for j, emote := range pkg.Emote {
		if emote.Text == "" {
			continue
		}
		eg.Go(func() error {
			// 判断是否为颜文字（纯文本表情）
			isTextEmoji := emote.URL == "" || emote.URL == emote.Text

			var urlValue, gifUrlValue, sourceUrlValue string

			if isTextEmoji {
				urlValue = emote.Text
				log.Printf("检测到颜文字: %s，直接存储到 url 字段", emote.Text)
			} else {
				localStaticPath, err := s.downloader.Download(emote.URL)
				if err != nil {
					log.Printf("警告: 下载表情 %s 静态图失败: %v", emote.Text, err)
					return nil // 单张失败跳过，不阻断整组
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

			mu.Lock()
			results = append(results, downloadedEmoji{
				emote:     emote,
				url:       urlValue,
				gifURL:    gifUrlValue,
				sourceURL: sourceUrlValue,
				sortOrder: j + 1,
			})
			mu.Unlock()
			return nil
		})
	}
	_ = eg.Wait()

	// 按 sortOrder 排序，保持与 B站原始顺序一致（SortOrder 用）
	sort.Slice(results, func(i, k int) bool {
		return results[i].sortOrder < results[k].sortOrder
	})
	return results
}

// ReseedBilibiliEmojis 全量重新拉取 B站表情并按 name 增量合并（upsert）。
// 与 SeedBilibiliEmojis 的区别：永远走全量 upsert，不看分组计数；
// 不删除任何分组（B站不再返回的历史分组保留）。
// progress 回调每完成一个分组上报进度，可为 nil。
// client 由调用方提供（启动期用 s.client，重新拉取用请求级 cookie 构造的临时 client）。
func (s *EmojiSeedService) ReseedBilibiliEmojis(ctx context.Context, client *bilibili.Client, progress func(domainemoji.RefetchProgress)) error {
	log.Info().Str("operation", "ReseedBilibiliEmojis").Msg("开始重新拉取 B站表情（upsert）")

	packages, err := client.FetchEmojis(ctx, s.apiType)
	if err != nil {
		return fmt.Errorf("获取 B站表情失败: %w", err)
	}
	log.Info().Int("packages", len(packages)).Msg("获取到表情包组")

	if progress != nil {
		progress(domainemoji.RefetchProgress{GroupsTotal: len(packages)})
	}

	done := 0
	for i, pkg := range packages {
		if pkg.Text == "" || len(pkg.Emote) == 0 {
			done++
			if progress != nil {
				progress(domainemoji.RefetchProgress{GroupsDone: done, GroupsTotal: len(packages)})
			}
			continue
		}

		// 封面下载
		coverURL, err := s.downloadCoverImage(ctx, pkg)
		if err != nil {
			log.Warn().Err(err).Str("group", pkg.Text).Msg("下载分组封面失败，使用远程 URL 兜底")
			coverURL = bilibili.PackageCoverURL(pkg)
		}

		// upsert 分组（按 name 合并，source 标记为 bilibili）
		g, err := domainemoji.NewEmojiGroup(0, pkg.Text, domainemoji.SourceBilibili)
		if err != nil {
			log.Printf("警告: 构造分组 %s 失败: %v", pkg.Text, err)
			done++
			continue
		}
		g.SetCoverURL(coverURL)
		g.SetSortOrder(i + 1)
		g.SetEnabled(true)
		groupID, err := s.repo.UpsertByName(ctx, g)
		if err != nil {
			log.Printf("警告: upsert 分组 %s 失败: %v", pkg.Text, err)
			done++
			continue
		}

		// 并发下载表情图 + upsert
		emojis := s.downloadPackageEmojis(ctx, pkg)
		for _, de := range emojis {
			domainEmoji := domainemoji.NewEmoji(0, groupID, de.emote.Text, de.url)
			domainEmoji.Update(de.emote.Text, de.url, "", de.gifURL, de.sourceURL, de.sortOrder)
			domainEmoji.SetMeta(emoteMetaToDomain(de.emote))
			if _, err := s.repo.UpsertEmojiByName(ctx, domainEmoji); err != nil {
				log.Printf("警告: upsert 表情 %s 失败: %v", de.emote.Text, err)
			}
		}

		done++
		if progress != nil {
			progress(domainemoji.RefetchProgress{GroupsDone: done, GroupsTotal: len(packages)})
		}
	}

	log.Info().Int("packages", done).Msg("重新拉取完成")
	return nil
}

// Reseed 是 ReseedRunner 接口的适配方法。
// 用请求级 cookie 构造临时 client，委托给 ReseedBilibiliEmojis，不影响启动期注入的 s.client。
func (s *EmojiSeedService) Reseed(ctx context.Context, cookie string, progress func(domainemoji.RefetchProgress)) error {
	return s.ReseedBilibiliEmojis(ctx, bilibili.NewClient(cookie), progress)
}

// BilibiliCookieDefault 返回启动期注入的 B站 Cookie，供后台弹窗预填。
func (s *EmojiSeedService) BilibiliCookieDefault() string {
	return s.client.Cookie()
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

	groups, err := s.repo.FindGroupsNeedingCover(ctx, domainemoji.SourceBilibili)
	if err != nil {
		return nil, fmt.Errorf("查询待回填封面分组失败: %w", err)
	}

	for _, g := range groups {
		coverURL, ok := coverByName[g.Name()]
		if !ok {
			log.Warn().Str("group", g.Name()).Msg("本地 bilibili 分组未在 B站 API 中匹配到封面")
			continue
		}

		log.Info().Str("group", g.Name()).Str("remote_url", coverURL).Msg("开始下载分组封面")
		localCoverURL, err := s.downloader.Download(coverURL)
		if err != nil {
			log.Warn().Err(err).Str("group", g.Name()).Str("remote_url", coverURL).Msg("下载封面失败，使用远程 URL")
			localCoverURL = coverURL
		} else {
			log.Info().Str("group", g.Name()).Str("local_url", localCoverURL).Msg("分组封面下载完成")
		}

		if err := s.repo.UpdateCoverURL(ctx, g.ID(), localCoverURL); err != nil {
			log.Printf("更新分组 %s 封面失败: %v", g.Name(), err)
			continue
		}
		result.CoversBackfilled++
		log.Printf("已回填封面: %s", g.Name())
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
