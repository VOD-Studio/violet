package mcp

import (
	"context"
	"errors"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	appseries "blog-api/internal/application/series"
	domainapitoken "blog-api/internal/domain/api_token"
)

// SeriesServicePort series tools 消费的窄端口。
// 由 *appseries.Service 的既有公开方法 + 两个 owner 视角新方法满足。
type SeriesServicePort interface {
	ListForOwner(ctx context.Context, userID string, page, limit int) ([]appseries.SeriesAdminDTO, int64, error)
	GetForOwner(ctx context.Context, userID, slug string) (appseries.SeriesDetailDTO, error)
	Create(ctx context.Context, in appseries.CreateInput) (appseries.SeriesAdminDTO, error)
	AttachChapters(ctx context.Context, seriesID string, in appseries.AttachInput) (appseries.SeriesDetailDTO, error)
	// FindPostConflicts 预检挂章冲突：返回 postIDs 中已挂其他书的文章元数据。
	FindPostConflicts(ctx context.Context, userID string, postIDs []string) ([]appseries.PostConflict, error)
}

// SeriesTools 书籍管理 tool 集（violet-posts server，#272）。
//
// 归属：书是文章的组织形态，挂文章 server 不建新 server。
// 视角：agent=PAT 持有人，owner-only（与 post tools 的「仅动自己文章」一致）。
type SeriesTools struct {
	series SeriesServicePort
}

func NewSeriesTools(series SeriesServicePort) *SeriesTools {
	return &SeriesTools{series: series}
}

// --- args（jsonschema 由结构体 tag 推导） ---

type listSeriesArgs struct {
	Page  int `json:"page,omitempty" jsonschema:"页码（从 1 开始，默认 1）"`
	Limit int `json:"limit,omitempty" jsonschema:"每页条数（默认 20，上限 100）"`
}

type getSeriesArgs struct {
	Slug string `json:"slug" jsonschema:"书 slug"`
}

type createSeriesArgs struct {
	Title       string `json:"title" jsonschema:"书名"`
	Slug        string `json:"slug" jsonschema:"URL slug（小写字母数字连字符）"`
	Description string `json:"description,omitempty" jsonschema:"简介（可空）"`
}

type attachChaptersArgs struct {
	SeriesID  string   `json:"series_id" jsonschema:"目标书 ID（get_series / create_series 返回）"`
	PostIDs   []string `json:"post_ids" jsonschema:"要挂入的文章 ID 列表（来自 list_drafts / search_posts 的结果）；连载文章发完后把同主题系列挂成书"`
	SectionID string   `json:"section_id,omitempty" jsonschema:"挂入的卷 ID；空=书根"`
}

// --- tool handlers ---

// ListSeries 列 PAT 持有人自己的书（含 draft）。需 posts:read。
func (t *SeriesTools) ListSeries(ctx context.Context, req *mcp.CallToolRequest, args listSeriesArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopePostsRead); err != nil {
		return errResult(err), nil, nil
	}
	items, total, err := t.series.ListForOwner(ctx, operatorUserID(req), nz(args.Page, 1), nz(args.Limit, 20))
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(map[string]any{
		"total": total,
		"items": items,
	}), nil, nil
}

// GetSeries 按 slug 读自己的书（含两层目录与章节 ID/slug——attach 的协作入口）。需 posts:read。
func (t *SeriesTools) GetSeries(ctx context.Context, req *mcp.CallToolRequest, args getSeriesArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopePostsRead); err != nil {
		return errResult(err), nil, nil
	}
	detail, err := t.series.GetForOwner(ctx, operatorUserID(req), args.Slug)
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(detail), nil, nil
}

// CreateSeries 建书（draft 起步，发布走后台）。需 posts:write。
//
// slug 冲突返回结构化 options（换名/放弃）供 agent 转述用户（#272）。
func (t *SeriesTools) CreateSeries(ctx context.Context, req *mcp.CallToolRequest, args createSeriesArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopePostsWrite); err != nil {
		return errResult(err), nil, nil
	}
	created, err := t.series.Create(ctx, appseries.CreateInput{
		UserID:      operatorUserID(req),
		Title:       args.Title,
		Slug:        args.Slug,
		Description: args.Description,
	})
	if err != nil {
		// 仅 slug 冲突返回候选；其他错误（校验/DB）普通呈现，不误导 agent（评审修复）
		if errors.Is(err, appseries.ErrSlugTaken) {
			return errResult(err), createSeriesConflictPayload(args.Slug), nil
		}
		return errResult(err), nil, nil
	}
	return okResult(created), nil, nil
}

// AttachChapters 批量挂章。需 posts:write。
//
// 冲突交互按 PAT interactive 偏好分叉（#272）：
//   - interactive=true（默认）：返回结构化 options（跳过冲突章/中止），agent 转述用户决策
//   - interactive=false：自动跳过冲突章挂入其余，返回报告（一路到底）
func (t *SeriesTools) AttachChapters(ctx context.Context, req *mcp.CallToolRequest, args attachChaptersArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopePostsWrite); err != nil {
		return errResult(err), nil, nil
	}
	userID := operatorUserID(req)

	conflicts, err := t.series.FindPostConflicts(ctx, userID, args.PostIDs)
	if err != nil {
		return errResult(err), nil, nil
	}
	if len(conflicts) > 0 && tokenInteractive(req) {
		return okResult(attachConflictPayload(args.PostIDs, conflicts)), nil, nil
	}

	attachIDs := filterConflicts(args.PostIDs, conflicts)
	if len(attachIDs) == 0 {
		return okResult(map[string]any{
			"attached": 0,
			"message":  "没有可挂入的章节（全部冲突或为空）",
		}), nil, nil
	}
	detail, err := t.series.AttachChapters(ctx, args.SeriesID, appseries.AttachInput{
		UserID:    userID,
		PostIDs:   attachIDs,
		SectionID: args.SectionID,
	})
	if err != nil {
		return errResult(err), nil, nil
	}
	report := map[string]any{
		"attached":   len(attachIDs),
		"series_id":  args.SeriesID,
		"chapters":   detail.RootChapters,
		"sections":   detail.Sections,
	}
	if len(conflicts) > 0 {
		report["skipped_conflicts"] = len(conflicts)
	}
	return okResult(report), nil, nil
}

// --- helpers ---

// tokenInteractive 读 PAT 交互偏好；未认证或缺失默认 true（保守）。
func tokenInteractive(req *mcp.CallToolRequest) bool {
	ti := tokenInfo(req)
	if ti == nil {
		return true
	}
	if v, ok := ti.Extra["interactive"].(bool); ok {
		return v
	}
	return true
}

func filterConflicts(all []string, conflicts []appseries.PostConflict) []string {
	cset := make(map[string]struct{}, len(conflicts))
	for _, c := range conflicts {
		cset[c.PostID] = struct{}{}
	}
	out := make([]string, 0, len(all))
	for _, id := range all {
		if _, hit := cset[id]; !hit {
			out = append(out, id)
		}
	}
	return out
}

// attachConflictPayload 冲突时的结构化返回：冲突明细 + options 供 agent 转述。
func attachConflictPayload(all []string, conflicts []appseries.PostConflict) map[string]any {
	conflictViews := make([]map[string]any, 0, len(conflicts))
	for _, c := range conflicts {
		conflictViews = append(conflictViews, map[string]any{
			"post_id": c.PostID, "title": c.Title, "held_by": c.HeldBy,
		})
	}
	skippable := len(all) - len(conflicts)
	return map[string]any{
		"attached":  0,
		"conflicts": conflictViews,
		"options": []map[string]any{
			{"value": "skip", "label": fmt.Sprintf("跳过 %d 个冲突章，挂入其余 %d 章（重新调用并去掉冲突 post_ids）", len(conflicts), skippable), "recommended": true},
			{"value": "abort", "label": "保持现状，不挂入"},
		},
	}
}

// createSeriesConflictPayload slug 冲突时的结构化 options。
func createSeriesConflictPayload(slug string) map[string]any {
	return map[string]any{
		"options": []map[string]any{
			{"value": "rename", "label": fmt.Sprintf("slug %s 已被占用，换一个重试（如追加 -book/-notes 后缀）", slug), "recommended": true},
			{"value": "abort", "label": "放弃创建"},
		},
	}
}

func nz(v, def int) int {
	if v <= 0 {
		return def
	}
	return v
}
