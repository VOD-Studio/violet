package subscription

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainsubscription "blog-api/internal/domain/subscription"
	domainentry "blog-api/internal/domain/subscription_entry"
	"blog-api/internal/domain/shared"

	apppost "blog-api/internal/application/post"
)

// --- FetchOne 依赖的 fake ---

type fakeEntryRepo struct {
	byKey map[string]*domainentry.SubscriptionEntry // key = subID|guid
	saved []*domainentry.SubscriptionEntry
	err   error
	saveErr error // 仅 Save 失败（FindBySubAndGUID 不受影响）
}

func newFakeEntryRepo() *fakeEntryRepo {
	return &fakeEntryRepo{byKey: map[string]*domainentry.SubscriptionEntry{}}
}

func (r *fakeEntryRepo) Save(ctx context.Context, e *domainentry.SubscriptionEntry) error {
	if r.saveErr != nil {
		return r.saveErr
	}
	if r.err != nil {
		return r.err
	}
	key := e.SubscriptionID().String() + "|" + e.GUID()
	r.saved = append(r.saved, e)
	cp := *e
	r.byKey[key] = &cp
	return nil
}

func (r *fakeEntryRepo) FindBySubAndGUID(ctx context.Context, subID shared.ID, guid string) (*domainentry.SubscriptionEntry, error) {
	if r.err != nil {
		return nil, r.err
	}
	key := subID.String() + "|" + guid
	if e, ok := r.byKey[key]; ok {
		cp := *e
		return &cp, nil
	}
	return nil, nil
}

type fakeImporter struct {
	importURLs []string // 记录所有调用（按顺序）
	importRes  apppost.ImportResult
	importErr  error

	createInputs []*apppost.CreateInput
	createRes    apppost.PostDTO
	createErr    error

	publishIDs []string // 记录所有 Publish 调用
	publishErr error
}

func (f *fakeImporter) ImportURL(ctx context.Context, rawURL string, opts apppost.ImportURLOpts) (apppost.ImportResult, error) {
	f.importURLs = append(f.importURLs, rawURL)
	return f.importRes, f.importErr
}

func (f *fakeImporter) Create(ctx context.Context, in apppost.CreateInput) (apppost.PostDTO, error) {
	cp := in
	f.createInputs = append(f.createInputs, &cp)
	return f.createRes, f.createErr
}

func (f *fakeImporter) Publish(ctx context.Context, id string) error {
	f.publishIDs = append(f.publishIDs, id)
	return f.publishErr
}

type fakeParser struct {
	items     []FeedItem
	feedTitle string
	err       error
}

func (f *fakeParser) Parse(ctx context.Context, feedURL string) (string, []FeedItem, error) {
	return f.feedTitle, f.items, f.err
}

// --- 测试 ---

// setupFetchSvc 构造带 FetchOne 依赖的 Service + 一个已存在的订阅。
func setupFetchSvc(t *testing.T) (*Service, *fakeRepo, *fakeEntryRepo, *fakeImporter, *fakeParser, *domainsubscription.Subscription) {
	t.Helper()
	repo := newFakeRepo()
	entryRepo := newFakeEntryRepo()
	// createRes.ID 必须是合法 UUID（fetchAndImport 用 shared.ParseID 解析回填 post_id）
	postID := shared.NewID()
	importer := &fakeImporter{
		importRes: apppost.ImportResult{Title: "正文标题", HTML: "<p>x</p>", Markdown: "x"},
		createRes: apppost.PostDTO{ID: postID.String()},
	}
	parser := &fakeParser{}
	svc := NewService(repo, nil, nil)
	svc.SetFetchDeps(entryRepo, importer, parser)

	sub, err := domainsubscription.NewSubscription(shared.NewID(), "https://feed.example.com/rss", "源", domainsubscription.IntervalDaily, svc.now())
	require.NoError(t, err)
	repo.subs[sub.ID().String()] = sub
	return svc, repo, entryRepo, importer, parser, sub
}

func TestFetchOne_ImportsNewEntries(t *testing.T) {
	svc, _, entryRepo, importer, parser, sub := setupFetchSvc(t)
	parser.items = []FeedItem{
		{GUID: "g1", Link: "https://example.com/1", Title: "文章1"},
		{GUID: "g2", Link: "https://example.com/2", Title: "文章2"},
	}

	report := svc.FetchOne(context.Background(), sub.ID().String())

	assert.Empty(t, report.SubscriptionError)
	assert.Equal(t, 2, report.FeedEntryCount)
	assert.Equal(t, 2, report.NewEntries)
	assert.Equal(t, 2, report.Imported)
	require.Len(t, importer.importURLs, 2, "应抓两条 entry")
	assert.Equal(t, "https://example.com/1", importer.importURLs[0])
	assert.Equal(t, "https://example.com/2", importer.importURLs[1])
	require.Len(t, importer.createInputs, 2)
	assert.Equal(t, "正文标题", importer.createInputs[0].Title)
	assert.Len(t, entryRepo.saved, 2)
	assert.Equal(t, domainentry.StatusImported, entryRepo.saved[0].Status())
	assert.NotNil(t, entryRepo.saved[0].PostID(), "post_id 应回填")
}

func TestFetchOne_DedupesAlreadyImportedEntries(t *testing.T) {
	svc, _, entryRepo, _, parser, sub := setupFetchSvc(t)
	// 预置一条已 imported 的 entry
	existing := domainentry.NewEntry(sub.ID(), "g1", "https://example.com/1", "旧", nil, svc.now())
	existing.MarkImported(shared.NewID())
	entryRepo.byKey[sub.ID().String()+"|g1"] = existing

	parser.items = []FeedItem{
		{GUID: "g1", Link: "https://example.com/1", Title: "旧"}, // 已 imported，跳过
		{GUID: "g2", Link: "https://example.com/2", Title: "新"}, // 新
	}

	report := svc.FetchOne(context.Background(), sub.ID().String())

	assert.Equal(t, 2, report.FeedEntryCount)
	assert.Equal(t, 1, report.Imported, "只导入新的")
	assert.Equal(t, 1, report.Skipped, "已 imported 应跳过")
	assert.Equal(t, 1, report.NewEntries)
}

func TestFetchOne_DedupesDeadEntries(t *testing.T) {
	svc, _, entryRepo, _, parser, sub := setupFetchSvc(t)
	// 预置一条 dead（达 fail_count 上限）
	dead := domainentry.NewEntry(sub.ID(), "g1", "https://example.com/1", "坏", nil, svc.now())
	for i := 0; i < domainentry.MaxFailCount; i++ {
		dead.RecordFailure("err")
	}
	require.Equal(t, domainentry.StatusDead, dead.Status())
	entryRepo.byKey[sub.ID().String()+"|g1"] = dead

	parser.items = []FeedItem{{GUID: "g1", Link: "https://example.com/1", Title: "坏"}}

	report := svc.FetchOne(context.Background(), sub.ID().String())
	assert.Equal(t, 1, report.Skipped, "dead 应跳过不重试")
	assert.Equal(t, 0, report.Imported)
}

func TestFetchOne_ImportSuccessButEntrySaveFails_CountNotNegative(t *testing.T) {
	svc, _, entryRepo, _, parser, sub := setupFetchSvc(t)
	entryRepo.saveErr = errors.New("db down") // 导入成功但 entry 持久化失败
	parser.items = []FeedItem{{GUID: "g1", Link: "https://example.com/1", Title: "x"}}

	report := svc.FetchOne(context.Background(), sub.ID().String())

	assert.Equal(t, 0, report.Imported, "Save 失败回退后 Imported 应归零，不为负")
	assert.Equal(t, 0, report.Failed, "本轮无导入失败")
	assert.Equal(t, 0, report.NewEntries, "未落地不算新 entry")
	assert.Contains(t, report.SubscriptionError, "持久化失败")
}

func TestFetchOne_FailureIncrementsFailCount(t *testing.T) {
	svc, _, entryRepo, importer, parser, sub := setupFetchSvc(t)
	importer.importErr = errors.New("网络挂了") // 抓正文失败

	parser.items = []FeedItem{{GUID: "g1", Link: "https://example.com/1", Title: "x"}}

	report := svc.FetchOne(context.Background(), sub.ID().String())

	assert.Equal(t, 1, report.Failed)
	assert.Equal(t, 0, report.Dead, "首次失败未达上限不应 dead")
	require.Len(t, entryRepo.saved, 1)
	assert.Equal(t, domainentry.StatusFailed, entryRepo.saved[0].Status())
	assert.Equal(t, 1, entryRepo.saved[0].FailCount())
	assert.Contains(t, entryRepo.saved[0].LastError(), "网络挂了")
}

func TestFetchOne_FailureReachesDeadAfter3Times(t *testing.T) {
	svc, _, entryRepo, importer, parser, sub := setupFetchSvc(t)
	importer.importErr = errors.New("持续失败")
	parser.items = []FeedItem{{GUID: "g1", Link: "https://example.com/1", Title: "x"}}

	// 连抓 3 次，每次失败
	for i := 0; i < domainentry.MaxFailCount; i++ {
		entryRepo.saved = nil // 清空观察本轮
		report := svc.FetchOne(context.Background(), sub.ID().String())
		assert.Equal(t, 1, report.Failed)
		if i < domainentry.MaxFailCount-1 {
			assert.Equal(t, 0, report.Dead, "第 %d 次不应 dead", i+1)
		}
	}

	// 第 3 次后应 dead
	lastReport := svc.FetchOne(context.Background(), sub.ID().String())
	// 注意：dead 后 IsProcessed 返回 true，第 4 次会 Skipped
	assert.Equal(t, 1, lastReport.Skipped, "dead 后应跳过")
}

func TestFetchOne_CanonicalOverrideWins(t *testing.T) {
	svc, _, _, importer, parser, sub := setupFetchSvc(t)
	// 给订阅配 canonical_override
	require.NoError(t, sub.UpdateConfig("t", "", false, "https://override.example/canonical", nil))

	parser.items = []FeedItem{{GUID: "g1", Link: "https://example.com/1", Title: "x"}}
	svc.FetchOne(context.Background(), sub.ID().String())

	require.NotNil(t, importer.createInputs[0])
	require.NotNil(t, importer.createInputs[0].CanonicalURL)
	assert.Equal(t, "https://override.example/canonical", *importer.createInputs[0].CanonicalURL,
		"canonical_override 非空时应覆盖 entry.link")
}

func TestFetchOne_CanonicalDefaultsToEntryLink(t *testing.T) {
	svc, _, _, importer, parser, sub := setupFetchSvc(t)
	// 不配 override
	parser.items = []FeedItem{{GUID: "g1", Link: "https://example.com/1", Title: "x"}}
	svc.FetchOne(context.Background(), sub.ID().String())

	require.NotNil(t, importer.createInputs[0])
	require.NotNil(t, importer.createInputs[0].CanonicalURL)
	assert.Equal(t, "https://example.com/1", *importer.createInputs[0].CanonicalURL,
		"无 override 时 canonical = entry.link")
}

func TestFetchOne_AutoPublishTrueCallsPublish(t *testing.T) {
	svc, _, _, importer, parser, sub := setupFetchSvc(t)
	// 开启 auto_publish：应建草稿后调 Publish（真实现 published 路径，T7 review 阻断项 0）
	require.NoError(t, sub.UpdateConfig("t", "", true, "", nil))

	parser.items = []FeedItem{{GUID: "g1", Link: "https://example.com/1", Title: "x"}}
	report := svc.FetchOne(context.Background(), sub.ID().String())

	assert.Equal(t, 1, report.Imported)
	require.Len(t, importer.createInputs, 1, "应建草稿")
	require.Len(t, importer.publishIDs, 1, "auto_publish=true 应调 Publish")
	assert.Equal(t, importer.createRes.ID, importer.publishIDs[0], "应发布刚建的草稿")
}

func TestFetchOne_AutoPublishFalseDoesNotCallPublish(t *testing.T) {
	svc, _, _, importer, parser, sub := setupFetchSvc(t)
	// auto_publish=false（默认）：只建草稿，不调 Publish
	parser.items = []FeedItem{{GUID: "g1", Link: "https://example.com/1", Title: "x"}}
	svc.FetchOne(context.Background(), sub.ID().String())

	require.Len(t, importer.createInputs, 1, "应建草稿")
	assert.Empty(t, importer.publishIDs, "auto_publish=false 不应调 Publish")
}

func TestFetchOne_AutoPublishPublishFailureFailsEntry(t *testing.T) {
	svc, _, entryRepo, importer, parser, sub := setupFetchSvc(t)
	require.NoError(t, sub.UpdateConfig("t", "", true, "", nil))
	importer.publishErr = errors.New("无权发布") // Publish 失败

	parser.items = []FeedItem{{GUID: "g1", Link: "https://example.com/1", Title: "x"}}
	report := svc.FetchOne(context.Background(), sub.ID().String())

	assert.Equal(t, 1, report.Failed, "Publish 失败应计入 Failed")
	require.Len(t, entryRepo.saved, 1)
	assert.Equal(t, domainentry.StatusFailed, entryRepo.saved[0].Status(), "entry 应记失败")
	assert.Contains(t, entryRepo.saved[0].LastError(), "自动发布失败")
}

func TestFetchOne_FeedErrorSurfacesToReport(t *testing.T) {
	svc, _, _, _, parser, sub := setupFetchSvc(t)
	parser.err = errors.New("feed 404")

	report := svc.FetchOne(context.Background(), sub.ID().String())

	assert.Contains(t, report.SubscriptionError, "feed 404")
	assert.Equal(t, 0, report.FeedEntryCount, "feed 错误时不应处理条目")
}

func TestFetchOne_GuidFallbackToLink(t *testing.T) {
	svc, _, entryRepo, _, parser, sub := setupFetchSvc(t)
	// entry 无 GUID，应回退 link 作为去重锚点
	parser.items = []FeedItem{{GUID: "", Link: "https://example.com/no-guid", Title: "x"}}

	report := svc.FetchOne(context.Background(), sub.ID().String())

	assert.Equal(t, 1, report.Imported)
	require.Len(t, entryRepo.saved, 1)
	assert.Equal(t, "https://example.com/no-guid", entryRepo.saved[0].GUID(),
		"无 GUID 时应回退 link 作去重锚点")
}

func TestFetchOne_WithoutFetchDepsReturnsError(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo, nil, nil) // 不注入 FetchDeps
	sub, _ := domainsubscription.NewSubscription(shared.NewID(), "https://x/feed", "t", domainsubscription.IntervalDaily, svc.now())
	repo.subs[sub.ID().String()] = sub

	report := svc.FetchOne(context.Background(), sub.ID().String())
	assert.Contains(t, report.SubscriptionError, "依赖未注入")
}

func TestFetchOne_BackfillsTitleFromFeedWhenEmpty(t *testing.T) {
	svc, repo, _, _, parser, sub := setupFetchSvc(t)
	// 模拟创建时未传 title
	require.NoError(t, sub.UpdateConfig("", "", sub.AutoPublish(), sub.CanonicalOverride(), sub.Tags()))
	parser.feedTitle = "CoolShell"
	parser.items = []FeedItem{{GUID: "g1", Link: "https://example.com/1"}}

	report := svc.FetchOne(context.Background(), sub.ID().String())

	assert.Empty(t, report.SubscriptionError)
	assert.Equal(t, "CoolShell", repo.subs[sub.ID().String()].Title(), "title 空时应从 feed 回填")
}

func TestFetchOne_KeepsExistingTitle(t *testing.T) {
	svc, repo, _, _, parser, sub := setupFetchSvc(t) // 订阅 title = "源"
	parser.feedTitle = "CoolShell"
	parser.items = []FeedItem{{GUID: "g1", Link: "https://example.com/1"}}

	svc.FetchOne(context.Background(), sub.ID().String())

	assert.Equal(t, "源", repo.subs[sub.ID().String()].Title(), "已有 title 不应被覆盖")
}

func TestFetchOne_BackfillPreservesOtherConfig(t *testing.T) {
	svc, repo, _, _, parser, sub := setupFetchSvc(t)
	require.NoError(t, sub.UpdateConfig("", "", true, "https://canonical/x", []string{"转载"}))
	parser.feedTitle = "Go Blog"
	parser.items = []FeedItem{{GUID: "g1", Link: "https://example.com/1"}}

	svc.FetchOne(context.Background(), sub.ID().String())

	got := repo.subs[sub.ID().String()]
	assert.Equal(t, "Go Blog", got.Title())
	assert.True(t, got.AutoPublish(), "回填不应覆盖 auto_publish")
	assert.Equal(t, "https://canonical/x", got.CanonicalOverride(), "回填不应覆盖 canonical_override")
	assert.Equal(t, []string{"转载"}, got.Tags(), "回填不应覆盖 tags")
}

func TestFetchOne_BackfillSaveFailureIgnored(t *testing.T) {
	svc, repo, entryRepo, _, parser, sub := setupFetchSvc(t)
	require.NoError(t, sub.UpdateConfig("", "", false, "", nil))
	parser.feedTitle = "Feed"
	parser.items = []FeedItem{{GUID: "g1", Link: "https://example.com/1", Title: "文章1"}}
	repo.saveErr = errors.New("db down")

	report := svc.FetchOne(context.Background(), sub.ID().String())

	assert.Empty(t, report.SubscriptionError, "回填 Save 失败不应阻塞抓取")
	assert.Equal(t, 1, report.Imported, "entry 应正常导入")
	require.Len(t, entryRepo.saved, 1)
	assert.NotNil(t, entryRepo.saved[0].PostID(), "post_id 应回填")
}


// ---- FetchNow（抓取 + 状态更新完整编排）----

func TestFetchNow_SuccessClearsFailureCount(t *testing.T) {
	svc, repo, _, _, parser, sub := setupFetchSvc(t)
	sub.RecordFailure(svc.now(), "old err") // 预置失败计数
	require.Equal(t, 1, sub.ConsecutiveFailures())
	repo.subs[sub.ID().String()] = sub // 回写预置计数的 sub
	parser.items = []FeedItem{{GUID: "g1", Link: "https://example.com/1", Title: "文章1"}}

	report := svc.FetchNow(context.Background(), sub.ID().String(), false)

	assert.Empty(t, report.SubscriptionError)
	// FetchNow 内 RecordSuccess 清零计数 + 推进 nextFetchAt + Save
	got := repo.subs[sub.ID().String()]
	assert.Equal(t, 0, got.ConsecutiveFailures(), "成功应清零计数")
}

func TestFetchNow_PermanentErrorPauses(t *testing.T) {
	svc, repo, _, _, parser, sub := setupFetchSvc(t)
	repo.subs[sub.ID().String()] = sub
	parser.err = &FeedError{Kind: FeedErrPermanent, StatusCode: 404}

	report := svc.FetchNow(context.Background(), sub.ID().String(), false)

	assert.NotEmpty(t, report.SubscriptionError)
	got := repo.subs[sub.ID().String()]
	assert.Equal(t, domainsubscription.StatusPaused, got.Status(), "永久错误应立即 paused")
}

func TestFetchNow_TransientErrorIncrementsCount(t *testing.T) {
	svc, repo, _, _, parser, sub := setupFetchSvc(t)
	repo.subs[sub.ID().String()] = sub
	parser.err = &FeedError{Kind: FeedErrTransient, StatusCode: 500}

	report := svc.FetchNow(context.Background(), sub.ID().String(), false)

	assert.NotEmpty(t, report.SubscriptionError)
	got := repo.subs[sub.ID().String()]
	assert.Equal(t, 1, got.ConsecutiveFailures(), "瞬时错误应计数")
	assert.Equal(t, domainsubscription.StatusActive, got.Status(), "首次瞬时不应 paused")
}

func TestFetchNow_RateLimitedSetsRetryAfter(t *testing.T) {
	svc, repo, _, _, parser, sub := setupFetchSvc(t)
	now := svc.now()
	repo.subs[sub.ID().String()] = sub
	retry := now.Add(30 * time.Minute)
	parser.err = &FeedError{Kind: FeedErrRateLimited, RetryAfter: &retry, StatusCode: 429}

	report := svc.FetchNow(context.Background(), sub.ID().String(), false)

	assert.NotEmpty(t, report.SubscriptionError)
	got := repo.subs[sub.ID().String()]
	assert.Equal(t, 0, got.ConsecutiveFailures(), "429 不增计数")
	require.NotNil(t, got.RetryAfterUntil())
	assert.True(t, got.RetryAfterUntil().Equal(retry))
	assert.Equal(t, domainsubscription.StatusActive, got.Status(), "429 不 paused")
}

func TestFetchNow_RateLimitedNoHeaderDefaultBackoff(t *testing.T) {
	svc, repo, _, _, parser, sub := setupFetchSvc(t)
	repo.subs[sub.ID().String()] = sub
	parser.err = &FeedError{Kind: FeedErrRateLimited, RetryAfter: nil, StatusCode: 429}

	before := svc.now()
	report := svc.FetchNow(context.Background(), sub.ID().String(), false)

	assert.NotEmpty(t, report.SubscriptionError)
	got := repo.subs[sub.ID().String()]
	require.NotNil(t, got.RetryAfterUntil(), "无 Retry-After 头时应用默认退避")
	assert.WithinDuration(t, before.Add(defaultRateLimitBackoff), *got.RetryAfterUntil(), time.Second, "默认退避应约为 now+1h")
}

func TestFetchNow_TransientAutoPausesAtThreshold(t *testing.T) {
	svc, repo, _, _, parser, sub := setupFetchSvc(t)
	for range domainsubscription.MaxConsecutiveFailures - 1 {
		sub.RecordFailure(svc.now(), "err")
	}
	repo.subs[sub.ID().String()] = sub
	parser.err = &FeedError{Kind: FeedErrTransient, StatusCode: 500}

	_ = svc.FetchNow(context.Background(), sub.ID().String(), false)

	got := repo.subs[sub.ID().String()]
	assert.Equal(t, domainsubscription.StatusPaused, got.Status(), "达阈值应自动 paused")
	assert.Equal(t, domainsubscription.MaxConsecutiveFailures, got.ConsecutiveFailures())
}