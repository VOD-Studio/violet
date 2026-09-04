package mcp

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/modelcontextprotocol/go-sdk/mcp"

	appseries "blog-api/internal/application/series"
	domainapitoken "blog-api/internal/domain/api_token"
)

// fakeSeriesToolsService 记录调用的最小桩。
type fakeSeriesToolsService struct {
	listOwner   string
	getOwner    string
	getSlug     string
	createInput appseries.CreateInput
	attachInput appseries.AttachInput
	conflicts   []appseries.PostConflict
	// 返回值控制
	listItems []appseries.SeriesAdminDTO
	detail    appseries.SeriesDetailDTO
	createErr error
	attachErr error
}

func (f *fakeSeriesToolsService) ListForOwner(ctx context.Context, userID string, page, limit int) ([]appseries.SeriesAdminDTO, int64, error) {
	f.listOwner = userID
	return f.listItems, int64(len(f.listItems)), nil
}

func (f *fakeSeriesToolsService) GetForOwner(ctx context.Context, userID, slug string) (appseries.SeriesDetailDTO, error) {
	f.getOwner, f.getSlug = userID, slug
	return f.detail, nil
}

func (f *fakeSeriesToolsService) Create(ctx context.Context, in appseries.CreateInput) (appseries.SeriesAdminDTO, error) {
	f.createInput = in
	return appseries.SeriesAdminDTO{}, f.createErr
}

func (f *fakeSeriesToolsService) AttachChapters(ctx context.Context, seriesID string, in appseries.AttachInput) (appseries.SeriesDetailDTO, error) {
	f.attachInput = in
	return f.detail, f.attachErr
}

func (f *fakeSeriesToolsService) FindPostConflicts(ctx context.Context, userID string, postIDs []string) ([]appseries.PostConflict, error) {
	return f.conflicts, nil
}

// authedReq 构造带 TokenInfo 的请求（scope + interactive 偏好）。
func authedReq(t *testing.T, interactive bool, scopes ...string) *mcp.CallToolRequest {
	t.Helper()
	return &mcp.CallToolRequest{
		Extra: &mcp.RequestExtra{
			TokenInfo: &auth.TokenInfo{
				UserID: "u-1",
				Scopes: scopes,
				Extra:  map[string]any{"interactive": interactive},
			},
		},
	}
}

func unauthedReq() *mcp.CallToolRequest {
	return &mcp.CallToolRequest{}
}

func decodeResultJSON(t *testing.T, res *mcp.CallToolResult) map[string]any {
	t.Helper()
	if len(res.Content) == 0 {
		t.Fatal("无内容")
	}
	text, ok := res.Content[0].(*mcp.TextContent)
	if !ok {
		t.Fatalf("首个内容不是文本: %T", res.Content[0])
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(text.Text), &m); err != nil {
		t.Fatalf("解析失败: %v", err)
	}
	return m
}

func TestSeriesList_RequiresScope(t *testing.T) {
	tools := NewSeriesTools(&fakeSeriesToolsService{})
	res, _, err := tools.ListSeries(context.Background(), unauthedReq(), listSeriesArgs{})
	if err != nil {
		t.Fatalf("err = %v（应把拒绝写进 result 而非 error）", err)
	}
	if res.IsError == false && len(res.Content) == 0 {
		t.Fatal("未认证应返回拒绝结果")
	}
}

func TestSeriesList_OwnerScope(t *testing.T) {
	fake := &fakeSeriesToolsService{listItems: []appseries.SeriesAdminDTO{{SeriesDTO: appseries.SeriesDTO{ID: "s1", Title: "书"}}}}
	tools := NewSeriesTools(fake)
	res, _, err := tools.ListSeries(context.Background(), authedReq(t, true, domainapitoken.ScopePostsRead), listSeriesArgs{})
	if err != nil {
		t.Fatal(err)
	}
	if fake.listOwner != "u-1" {
		t.Errorf("owner = %q, want u-1（PAT 持有人视角）", fake.listOwner)
	}
	m := decodeResultJSON(t, res)
	if m["total"] != float64(1) {
		t.Errorf("total = %v", m["total"])
	}
}

func TestAttachChapters_InteractiveTrueReturnsOptions(t *testing.T) {
	fake := &fakeSeriesToolsService{
		conflicts: []appseries.PostConflict{{PostID: "p3", Title: "冲突章", HeldBy: "other-book"}},
	}
	tools := NewSeriesTools(fake)
	res, _, err := tools.AttachChapters(context.Background(), authedReq(t, true, domainapitoken.ScopePostsWrite), attachChaptersArgs{
		SeriesID: "s1", PostIDs: []string{"p1", "p2", "p3"},
	})
	if err != nil {
		t.Fatal(err)
	}
	m := decodeResultJSON(t, res)
	if m["attached"] != float64(0) {
		t.Errorf("interactive=true 冲突时不应挂入, attached = %v", m["attached"])
	}
	options, ok := m["options"].([]any)
	if !ok || len(options) != 2 {
		t.Fatalf("options 缺失: %v", m["options"])
	}
	if fake.attachInput.PostIDs != nil {
		t.Error("interactive=true 冲突时不应调用 AttachChapters")
	}
}

func TestAttachChapters_InteractiveFalseSkipsConflicts(t *testing.T) {
	fake := &fakeSeriesToolsService{
		conflicts: []appseries.PostConflict{{PostID: "p3", Title: "冲突章", HeldBy: "other-book"}},
	}
	tools := NewSeriesTools(fake)
	res, _, err := tools.AttachChapters(context.Background(), authedReq(t, false, domainapitoken.ScopePostsWrite), attachChaptersArgs{
		SeriesID: "s1", PostIDs: []string{"p1", "p2", "p3"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(fake.attachInput.PostIDs) != 2 {
		t.Errorf("应过滤冲突后挂 2 章, 实际 %v", fake.attachInput.PostIDs)
	}
	m := decodeResultJSON(t, res)
	if m["attached"] != float64(2) {
		t.Errorf("attached = %v", m["attached"])
	}
	if m["skipped_conflicts"] != float64(1) {
		t.Errorf("skipped_conflicts = %v", m["skipped_conflicts"])
	}
}

func TestAttachChapters_NoConflictAttachesAll(t *testing.T) {
	fake := &fakeSeriesToolsService{}
	tools := NewSeriesTools(fake)
	_, _, err := tools.AttachChapters(context.Background(), authedReq(t, true, domainapitoken.ScopePostsWrite), attachChaptersArgs{
		SeriesID: "s1", PostIDs: []string{"p1", "p2"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(fake.attachInput.PostIDs) != 2 {
		t.Errorf("无冲突应全量挂入: %v", fake.attachInput.PostIDs)
	}
}
