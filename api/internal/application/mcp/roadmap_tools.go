package mcp

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	appproject "blog-api/internal/application/project"
	approadmap "blog-api/internal/application/roadmap"
	domainapitoken "blog-api/internal/domain/api_token"
	"blog-api/internal/middleware"
)

// RoadmapService 路线图 MCP tool 依赖的条目服务端口；application/roadmap.Service 实现之。
type RoadmapService interface {
	GetBySlug(ctx context.Context, slug string) (approadmap.DetailDTO, error)
	Create(ctx context.Context, projectID string, in approadmap.CreateInput) (approadmap.ItemDTO, error)
	Update(ctx context.Context, projectID, itemID string, in approadmap.UpdateInput) (approadmap.ItemDTO, error)
	Move(ctx context.Context, projectID, itemID string, in approadmap.MoveInput) (approadmap.ItemDTO, error)
	Delete(ctx context.Context, projectID, itemID string) error
	Restore(ctx context.Context, projectID, itemID string) (approadmap.ItemDTO, error)
}

// RoadmapRelationService 路线图关系端口；application/roadmap.RelationService 实现之。
type RoadmapRelationService interface {
	Create(ctx context.Context, projectID string, input approadmap.CreateRelationInput) (approadmap.RelationDTO, error)
	Delete(ctx context.Context, projectID, relationID string) error
}

// RoadmapProjectLister 列出公开项目；application/project.Service 实现之。
type RoadmapProjectLister interface {
	List(ctx context.Context) ([]appproject.ProjectDTO, error)
}

// Operator PAT 持有人当前的 RBAC 身份。
type Operator struct {
	Role   string
	IsRoot bool
	Active bool
}

// OperatorResolver 按用户 ID 取其角色与账号状态。
// 路线图服务按 project:update 校验写权限，所以 MCP 必须把持有人真实的角色带进 ctx，
// PAT 的 scope 只是在此之上再收窄，不能超出持有人自己的权限。
type OperatorResolver interface {
	Resolve(ctx context.Context, userID string) (Operator, error)
}

// 批量创建的上限：一次调用里的条目与关系数。
const (
	maxBatchItems     = 50
	maxBatchRelations = 100
)

// RoadmapTools 路线图 tool 集合，挂在 violet-roadmap server（/api/v1/mcp/roadmap）。
// 项目用 slug、条目用项目内编号（#N 的 N）定位；写操作以 PAT 持有人身份执行并留下审计。
type RoadmapTools struct {
	roadmaps  RoadmapService
	relations RoadmapRelationService
	projects  RoadmapProjectLister
	operators OperatorResolver
}

func NewRoadmapTools(roadmaps RoadmapService, relations RoadmapRelationService, projects RoadmapProjectLister, operators OperatorResolver) *RoadmapTools {
	return &RoadmapTools{roadmaps: roadmaps, relations: relations, projects: projects, operators: operators}
}

// --- tool 参数结构 ---

type listRoadmapProjectsArgs struct{}

type getRoadmapArgs struct {
	Project string `json:"project" jsonschema:"项目 slug（小写字母数字连字符），先用 list_projects 取得"`
}

type roadmapLinkArg struct {
	Label string `json:"label,omitempty" jsonschema:"链接名称，可空（显示时退回地址）"`
	URL   string `json:"url" jsonschema:"链接地址"`
}

type roadmapChecklistArg struct {
	Text string `json:"text" jsonschema:"子项内容，纯文本，最多 500 字"`
	Done bool   `json:"done,omitempty" jsonschema:"是否已完成，默认 false"`
}

type createItemArgs struct {
	Project          string                `json:"project" jsonschema:"项目 slug"`
	Title            string                `json:"title" jsonschema:"条目标题（必填，一句话说清要做什么或做了什么）"`
	Description      string                `json:"description,omitempty" jsonschema:"纯文本简介，可含换行"`
	Stage            string                `json:"stage,omitempty" jsonschema:"阶段：planned（默认）、in_progress、completed"`
	Tags             []string              `json:"tags,omitempty" jsonschema:"条目标签，自由文本，仅属于这个项目"`
	Links            []roadmapLinkArg      `json:"links,omitempty" jsonschema:"关联链接（设计稿、PR、发布说明等）"`
	Checklist        []roadmapChecklistArg `json:"checklist,omitempty" jsonschema:"子项清单：这个条目内的待办步骤，按顺序，最多 100 项；只展示推进细节，不改变阶段也不计入进度。不要把子项写进 description"`
	CompletionDate   *string               `json:"completion_date,omitempty" jsonschema:"完成日期 YYYY-MM-DD，仅 stage=completed 时有效；省略则取今天（上海时区）"`
	DeliveredVersion string                `json:"delivered_version,omitempty" jsonschema:"交付版本，自由文本，仅 stage=completed 时有效"`
}

type batchItemArg struct {
	Ref              string                `json:"ref,omitempty" jsonschema:"本批内的引用名，供 relations 指向；本批内唯一"`
	Title            string                `json:"title" jsonschema:"条目标题（必填）"`
	Description      string                `json:"description,omitempty" jsonschema:"纯文本简介"`
	Stage            string                `json:"stage,omitempty" jsonschema:"阶段：planned（默认）、in_progress、completed"`
	Tags             []string              `json:"tags,omitempty" jsonschema:"条目标签"`
	Links            []roadmapLinkArg      `json:"links,omitempty" jsonschema:"关联链接"`
	Checklist        []roadmapChecklistArg `json:"checklist,omitempty" jsonschema:"子项清单，按顺序，最多 100 项"`
	CompletionDate   *string               `json:"completion_date,omitempty" jsonschema:"完成日期 YYYY-MM-DD，仅 completed"`
	DeliveredVersion string                `json:"delivered_version,omitempty" jsonschema:"交付版本，仅 completed"`
}

type batchRelationArg struct {
	Source string `json:"source" jsonschema:"来源：本批条目的 ref，或已有条目的 #编号（例如 #3）"`
	Target string `json:"target" jsonschema:"目标：本批条目的 ref，或已有条目的 #编号"`
	Type   string `json:"type" jsonschema:"关系类型：extends、fixes、blocks；读作「来源 类型 目标」"`
}

type createItemsArgs struct {
	Project   string             `json:"project" jsonschema:"项目 slug"`
	Items     []batchItemArg     `json:"items" jsonschema:"要创建的条目，最多 50 个；同一阶段内按数组顺序排在末尾"`
	Relations []batchRelationArg `json:"relations,omitempty" jsonschema:"条目创建完后建立的关系，最多 100 条"`
}

type updateItemArgs struct {
	Project          string                `json:"project" jsonschema:"项目 slug"`
	Number           *int64                `json:"number,omitempty" jsonschema:"条目编号（#N 的 N），与 item_id 二选一"`
	ItemID           string                `json:"item_id,omitempty" jsonschema:"条目 ID（UUID），与 number 二选一"`
	Title            *string               `json:"title,omitempty" jsonschema:"新标题；省略则不改"`
	Description      *string               `json:"description,omitempty" jsonschema:"新简介；空串清除，省略则不改"`
	Tags             []string              `json:"tags,omitempty" jsonschema:"新标签（整体替换）；空数组清除，省略则不改"`
	Links            []roadmapLinkArg      `json:"links,omitempty" jsonschema:"新链接（整体替换）；空数组清除，省略则不改"`
	Checklist        []roadmapChecklistArg `json:"checklist,omitempty" jsonschema:"新子项清单（整体替换，勾选某一项也要把整张清单连同其余项一起传回）；空数组清除，省略则不改"`
	CompletionDate   *string               `json:"completion_date,omitempty" jsonschema:"新完成日期 YYYY-MM-DD，仅已完成条目；省略则不改"`
	DeliveredVersion *string               `json:"delivered_version,omitempty" jsonschema:"新交付版本，仅已完成条目；空串清除，省略则不改"`
}

type moveItemArgs struct {
	Project          string  `json:"project" jsonschema:"项目 slug"`
	Number           *int64  `json:"number,omitempty" jsonschema:"条目编号（#N 的 N），与 item_id 二选一"`
	ItemID           string  `json:"item_id,omitempty" jsonschema:"条目 ID（UUID），与 number 二选一"`
	Stage            string  `json:"stage" jsonschema:"目标阶段：planned、in_progress、completed"`
	AfterNumber      *int64  `json:"after_number,omitempty" jsonschema:"放到目标阶段内这个编号的条目之后；与 before_number 二选一，都不给则放到阶段末尾"`
	BeforeNumber     *int64  `json:"before_number,omitempty" jsonschema:"放到目标阶段内这个编号的条目之前"`
	CompletionDate   *string `json:"completion_date,omitempty" jsonschema:"进入 completed 时的完成日期 YYYY-MM-DD；省略取今天（上海时区）"`
	DeliveredVersion string  `json:"delivered_version,omitempty" jsonschema:"进入 completed 时的交付版本"`
}

type deleteItemArgs struct {
	Project string `json:"project" jsonschema:"项目 slug"`
	Number  *int64 `json:"number,omitempty" jsonschema:"条目编号（#N 的 N），与 item_id 二选一"`
	ItemID  string `json:"item_id,omitempty" jsonschema:"条目 ID（UUID），与 number 二选一"`
}

type restoreItemArgs struct {
	Project string `json:"project" jsonschema:"项目 slug"`
	ItemID  string `json:"item_id" jsonschema:"被删除条目的 ID（delete_item 的返回里有）"`
}

type createRelationArgs struct {
	Project      string `json:"project" jsonschema:"项目 slug"`
	SourceNumber int64  `json:"source_number" jsonschema:"来源条目编号"`
	TargetNumber int64  `json:"target_number" jsonschema:"目标条目编号"`
	Type         string `json:"type" jsonschema:"关系类型：extends、fixes、blocks；读作「来源 类型 目标」"`
}

type deleteRelationArgs struct {
	Project    string `json:"project" jsonschema:"项目 slug"`
	RelationID string `json:"relation_id" jsonschema:"关系 ID（get_roadmap 的 relations 里有）"`
}

// --- 公共步骤 ---

// writeContext 校验 scope 并把持有人的真实身份带进 ctx：服务据此按 project:update 判断，账号停用也拒绝。
func (t *RoadmapTools) writeContext(ctx context.Context, req *mcp.CallToolRequest) (context.Context, error) {
	if err := requireScope(req, domainapitoken.ScopeRoadmapWrite); err != nil {
		return nil, err
	}
	userID := operatorUserID(req)
	if userID == "" {
		return nil, fmt.Errorf("未认证：缺少访问令牌")
	}
	operator, err := t.operators.Resolve(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("读取令牌持有人失败: %w", err)
	}
	if !operator.Active {
		return nil, fmt.Errorf("令牌持有人的账号已停用")
	}
	ctx = context.WithValue(ctx, middleware.UserIDKey, userID)
	ctx = context.WithValue(ctx, middleware.UserRoleKey, operator.Role)
	return context.WithValue(ctx, middleware.UserIsRootKey, operator.IsRoot), nil
}

// roadmapView 一个项目当前的路线图快照，用来把编号解析成 ID。
type roadmapView struct {
	detail   approadmap.DetailDTO
	byNumber map[int64]approadmap.ItemDTO
	byID     map[string]approadmap.ItemDTO
}

func (t *RoadmapTools) view(ctx context.Context, slug string) (roadmapView, error) {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return roadmapView{}, fmt.Errorf("project 不能为空：传项目 slug，可先用 list_projects 查看")
	}
	detail, err := t.roadmaps.GetBySlug(ctx, slug)
	if err != nil {
		return roadmapView{}, err
	}
	view := roadmapView{
		detail:   detail,
		byNumber: make(map[int64]approadmap.ItemDTO, len(detail.Items)),
		byID:     make(map[string]approadmap.ItemDTO, len(detail.Items)),
	}
	for _, item := range detail.Items {
		view.byNumber[item.Number] = item
		view.byID[item.ID] = item
	}
	return view, nil
}

// item 按编号或 ID 找条目；两者恰好给一个。
func (v roadmapView) item(number *int64, itemID string) (approadmap.ItemDTO, error) {
	itemID = strings.TrimSpace(itemID)
	switch {
	case number != nil && itemID != "":
		return approadmap.ItemDTO{}, fmt.Errorf("number 与 item_id 只能给一个")
	case number != nil:
		if item, ok := v.byNumber[*number]; ok {
			return item, nil
		}
		return approadmap.ItemDTO{}, fmt.Errorf("项目里没有编号 #%d 的条目（已删除的条目请用 item_id）", *number)
	case itemID != "":
		if item, ok := v.byID[itemID]; ok {
			return item, nil
		}
		return approadmap.ItemDTO{}, fmt.Errorf("项目里没有 ID 为 %s 的条目", itemID)
	}
	return approadmap.ItemDTO{}, fmt.Errorf("需要 number 或 item_id 指定条目")
}

func toChecklist(entries []roadmapChecklistArg) []approadmap.ChecklistItemDTO {
	out := make([]approadmap.ChecklistItemDTO, 0, len(entries))
	for _, entry := range entries {
		out = append(out, approadmap.ChecklistItemDTO{Text: entry.Text, Done: entry.Done})
	}
	return out
}

func toLinks(links []roadmapLinkArg) []approadmap.LinkDTO {
	out := make([]approadmap.LinkDTO, 0, len(links))
	for _, link := range links {
		out = append(out, approadmap.LinkDTO{Label: link.Label, URL: link.URL})
	}
	return out
}

// --- 读 ---

// ListProjects 列出公开项目及其路线图摘要（需 roadmap:read）。
func (t *RoadmapTools) ListProjects(ctx context.Context, req *mcp.CallToolRequest, _ listRoadmapProjectsArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopeRoadmapRead); err != nil {
		return errResult(err), nil, nil
	}
	projects, err := t.projects.List(ctx)
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(projects), nil, nil
}

// GetRoadmap 读一个项目的完整路线图：全部条目、关系与进度（需 roadmap:read）。
func (t *RoadmapTools) GetRoadmap(ctx context.Context, req *mcp.CallToolRequest, args getRoadmapArgs) (*mcp.CallToolResult, any, error) {
	if err := requireScope(req, domainapitoken.ScopeRoadmapRead); err != nil {
		return errResult(err), nil, nil
	}
	view, err := t.view(ctx, args.Project)
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(view.detail), nil, nil
}

// --- 写 ---

// CreateItem 创建一个条目，追加到目标阶段末尾（需 roadmap:write）。
func (t *RoadmapTools) CreateItem(ctx context.Context, req *mcp.CallToolRequest, args createItemArgs) (*mcp.CallToolResult, any, error) {
	ctx, err := t.writeContext(ctx, req)
	if err != nil {
		return errResult(err), nil, nil
	}
	view, err := t.view(ctx, args.Project)
	if err != nil {
		return errResult(err), nil, nil
	}
	dto, err := t.roadmaps.Create(ctx, view.detail.Project.ID, approadmap.CreateInput{
		Title: args.Title, Description: args.Description, Stage: args.Stage, Tags: args.Tags,
		Links: toLinks(args.Links), Checklist: toChecklist(args.Checklist),
		CompletionDate: args.CompletionDate, DeliveredVersion: args.DeliveredVersion,
	})
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(dto), nil, nil
}

// batchRelationResult 批量创建里一条没建成的关系。
type batchRelationResult struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Type   string `json:"type"`
	Error  string `json:"error"`
}

// refNumber 解析 "#12" 形式的已有条目编号。
func refNumber(ref string) (int64, bool) {
	ref = strings.TrimSpace(ref)
	if !strings.HasPrefix(ref, "#") {
		return 0, false
	}
	number, err := strconv.ParseInt(ref[1:], 10, 64)
	return number, err == nil
}

// CreateItems 一次创建一批条目与它们之间的关系（需 roadmap:write）。
//
// 先整体校验（数量、ref 唯一、关系指向的 ref 或 #编号都存在），再依次创建；
// 条目创建失败就停下并报告已建好的编号，关系单条失败不影响其余。
func (t *RoadmapTools) CreateItems(ctx context.Context, req *mcp.CallToolRequest, args createItemsArgs) (*mcp.CallToolResult, any, error) {
	ctx, err := t.writeContext(ctx, req)
	if err != nil {
		return errResult(err), nil, nil
	}
	if len(args.Items) == 0 {
		return errResult(fmt.Errorf("items 不能为空")), nil, nil
	}
	if len(args.Items) > maxBatchItems || len(args.Relations) > maxBatchRelations {
		return errResult(fmt.Errorf("一次最多 %d 个条目、%d 条关系，请分批", maxBatchItems, maxBatchRelations)), nil, nil
	}
	view, err := t.view(ctx, args.Project)
	if err != nil {
		return errResult(err), nil, nil
	}
	refs := make(map[string]struct{}, len(args.Items))
	for index, item := range args.Items {
		ref := strings.TrimSpace(item.Ref)
		if ref == "" {
			continue
		}
		if _, dup := refs[ref]; dup {
			return errResult(fmt.Errorf("第 %d 个条目的 ref %q 重复", index+1, ref)), nil, nil
		}
		refs[ref] = struct{}{}
	}
	known := func(ref string) bool {
		if _, ok := refs[strings.TrimSpace(ref)]; ok {
			return true
		}
		number, ok := refNumber(ref)
		if !ok {
			return false
		}
		_, exists := view.byNumber[number]
		return exists
	}
	for index, relation := range args.Relations {
		for _, end := range []string{relation.Source, relation.Target} {
			if !known(end) {
				return errResult(fmt.Errorf("第 %d 条关系指向了不存在的 %q：用本批条目的 ref，或已有条目的 #编号", index+1, end)), nil, nil
			}
		}
	}

	created := make([]approadmap.ItemDTO, 0, len(args.Items))
	idByRef := make(map[string]string, len(args.Items))
	for index, item := range args.Items {
		dto, err := t.roadmaps.Create(ctx, view.detail.Project.ID, approadmap.CreateInput{
			Title: item.Title, Description: item.Description, Stage: item.Stage, Tags: item.Tags,
			Links: toLinks(item.Links), Checklist: toChecklist(item.Checklist),
			CompletionDate: item.CompletionDate, DeliveredVersion: item.DeliveredVersion,
		})
		if err != nil {
			numbers := make([]string, 0, len(created))
			for _, done := range created {
				numbers = append(numbers, fmt.Sprintf("#%d", done.Number))
			}
			return errResult(fmt.Errorf("第 %d 个条目《%s》创建失败：%w。已创建 %d 个（%s），关系尚未建立；修正后只提交剩下的条目", index+1, item.Title, err, len(created), strings.Join(numbers, "、"))), nil, nil
		}
		created = append(created, dto)
		if ref := strings.TrimSpace(item.Ref); ref != "" {
			idByRef[ref] = dto.ID
		}
	}

	resolve := func(ref string) string {
		if id, ok := idByRef[strings.TrimSpace(ref)]; ok {
			return id
		}
		number, _ := refNumber(ref)
		return view.byNumber[number].ID
	}
	relations := make([]approadmap.RelationDTO, 0, len(args.Relations))
	failed := make([]batchRelationResult, 0)
	for _, relation := range args.Relations {
		dto, err := t.relations.Create(ctx, view.detail.Project.ID, approadmap.CreateRelationInput{
			SourceID: resolve(relation.Source), TargetID: resolve(relation.Target), Type: relation.Type,
		})
		if err != nil {
			failed = append(failed, batchRelationResult{Source: relation.Source, Target: relation.Target, Type: relation.Type, Error: err.Error()})
			continue
		}
		relations = append(relations, dto)
	}
	return okResult(map[string]any{"items": created, "relations": relations, "relation_errors": failed}), nil, nil
}

// UpdateItem 局部更新一个条目的内容（需 roadmap:write）：只改给出的字段，其余保持原样。
func (t *RoadmapTools) UpdateItem(ctx context.Context, req *mcp.CallToolRequest, args updateItemArgs) (*mcp.CallToolResult, any, error) {
	ctx, err := t.writeContext(ctx, req)
	if err != nil {
		return errResult(err), nil, nil
	}
	view, err := t.view(ctx, args.Project)
	if err != nil {
		return errResult(err), nil, nil
	}
	item, err := view.item(args.Number, args.ItemID)
	if err != nil {
		return errResult(err), nil, nil
	}
	input := approadmap.UpdateInput{
		Title: item.Title, Description: item.Description, Tags: item.Tags, Links: item.Links,
		Checklist: item.Checklist, DeliveredVersion: item.DeliveredVersion,
	}
	if args.Title != nil {
		input.Title = *args.Title
	}
	if args.Description != nil {
		input.Description = *args.Description
	}
	if args.Tags != nil {
		input.Tags = args.Tags
	}
	if args.Links != nil {
		input.Links = toLinks(args.Links)
	}
	if args.Checklist != nil {
		input.Checklist = toChecklist(args.Checklist)
	}
	if args.DeliveredVersion != nil {
		input.DeliveredVersion = *args.DeliveredVersion
	}
	input.CompletionDate = args.CompletionDate
	dto, err := t.roadmaps.Update(ctx, view.detail.Project.ID, item.ID, input)
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(dto), nil, nil
}

// neighbors 算出条目落在目标阶段某个锚点旁边时，两侧相邻条目的 ID。
func (v roadmapView) neighbors(moved approadmap.ItemDTO, stage string, after, before *int64) (previousID, nextID string, err error) {
	if after != nil && before != nil {
		return "", "", fmt.Errorf("after_number 与 before_number 只能给一个")
	}
	if after == nil && before == nil {
		return "", "", nil
	}
	inStage := make([]approadmap.ItemDTO, 0, len(v.detail.Items))
	for _, item := range v.detail.Items {
		if item.Stage == stage && item.ID != moved.ID {
			inStage = append(inStage, item)
		}
	}
	anchor := after
	if anchor == nil {
		anchor = before
	}
	at := -1
	for index, item := range inStage {
		if item.Number == *anchor {
			at = index
		}
	}
	if at < 0 {
		return "", "", fmt.Errorf("编号 #%d 的条目不在目标阶段 %s 里，无法以它定位", *anchor, stage)
	}
	if after != nil {
		previousID = inStage[at].ID
		if at+1 < len(inStage) {
			nextID = inStage[at+1].ID
		}
		return previousID, nextID, nil
	}
	nextID = inStage[at].ID
	if at > 0 {
		previousID = inStage[at-1].ID
	}
	return previousID, nextID, nil
}

// MoveItem 把条目移到某个阶段与位置（需 roadmap:write）。
func (t *RoadmapTools) MoveItem(ctx context.Context, req *mcp.CallToolRequest, args moveItemArgs) (*mcp.CallToolResult, any, error) {
	ctx, err := t.writeContext(ctx, req)
	if err != nil {
		return errResult(err), nil, nil
	}
	view, err := t.view(ctx, args.Project)
	if err != nil {
		return errResult(err), nil, nil
	}
	item, err := view.item(args.Number, args.ItemID)
	if err != nil {
		return errResult(err), nil, nil
	}
	previousID, nextID, err := view.neighbors(item, args.Stage, args.AfterNumber, args.BeforeNumber)
	if err != nil {
		return errResult(err), nil, nil
	}
	dto, err := t.roadmaps.Move(ctx, view.detail.Project.ID, item.ID, approadmap.MoveInput{
		Stage: args.Stage, BeforeID: previousID, AfterID: nextID,
		CompletionDate: args.CompletionDate, DeliveredVersion: args.DeliveredVersion,
	})
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(dto), nil, nil
}

// DeleteItem 软删除一个条目（需 roadmap:write）；返回的 item_id 可交给 restore_item 恢复。
func (t *RoadmapTools) DeleteItem(ctx context.Context, req *mcp.CallToolRequest, args deleteItemArgs) (*mcp.CallToolResult, any, error) {
	ctx, err := t.writeContext(ctx, req)
	if err != nil {
		return errResult(err), nil, nil
	}
	view, err := t.view(ctx, args.Project)
	if err != nil {
		return errResult(err), nil, nil
	}
	item, err := view.item(args.Number, args.ItemID)
	if err != nil {
		return errResult(err), nil, nil
	}
	if err := t.roadmaps.Delete(ctx, view.detail.Project.ID, item.ID); err != nil {
		return errResult(err), nil, nil
	}
	return okResult(map[string]any{"deleted": true, "number": item.Number, "item_id": item.ID}), nil, nil
}

// RestoreItem 恢复被软删除的条目（需 roadmap:write）：同编号、同位置、同内容。
func (t *RoadmapTools) RestoreItem(ctx context.Context, req *mcp.CallToolRequest, args restoreItemArgs) (*mcp.CallToolResult, any, error) {
	ctx, err := t.writeContext(ctx, req)
	if err != nil {
		return errResult(err), nil, nil
	}
	view, err := t.view(ctx, args.Project)
	if err != nil {
		return errResult(err), nil, nil
	}
	dto, err := t.roadmaps.Restore(ctx, view.detail.Project.ID, strings.TrimSpace(args.ItemID))
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(dto), nil, nil
}

// CreateRelation 建立两个条目之间的关系（需 roadmap:write）；自指、重复与同类型成环会被拒绝。
func (t *RoadmapTools) CreateRelation(ctx context.Context, req *mcp.CallToolRequest, args createRelationArgs) (*mcp.CallToolResult, any, error) {
	ctx, err := t.writeContext(ctx, req)
	if err != nil {
		return errResult(err), nil, nil
	}
	view, err := t.view(ctx, args.Project)
	if err != nil {
		return errResult(err), nil, nil
	}
	source, err := view.item(&args.SourceNumber, "")
	if err != nil {
		return errResult(err), nil, nil
	}
	target, err := view.item(&args.TargetNumber, "")
	if err != nil {
		return errResult(err), nil, nil
	}
	dto, err := t.relations.Create(ctx, view.detail.Project.ID, approadmap.CreateRelationInput{
		SourceID: source.ID, TargetID: target.ID, Type: args.Type,
	})
	if err != nil {
		return errResult(err), nil, nil
	}
	return okResult(dto), nil, nil
}

// DeleteRelation 移除一条关系（需 roadmap:write）。
func (t *RoadmapTools) DeleteRelation(ctx context.Context, req *mcp.CallToolRequest, args deleteRelationArgs) (*mcp.CallToolResult, any, error) {
	ctx, err := t.writeContext(ctx, req)
	if err != nil {
		return errResult(err), nil, nil
	}
	view, err := t.view(ctx, args.Project)
	if err != nil {
		return errResult(err), nil, nil
	}
	if err := t.relations.Delete(ctx, view.detail.Project.ID, strings.TrimSpace(args.RelationID)); err != nil {
		return errResult(err), nil, nil
	}
	return okResult(map[string]any{"deleted": true, "relation_id": args.RelationID}), nil, nil
}

// NewRoadmapServer 构造路线图 MCP 服务器（/api/v1/mcp/roadmap），注册 10 个 tool。
// 路线图是独立 bounded context（项目的开发计划），不挂 violet-posts。
func NewRoadmapServer(tools *RoadmapTools) *mcp.Server {
	s := mcp.NewServer(RoadmapServerMeta, &mcp.ServerOptions{Instructions: roadmapInstructions})

	mcp.AddTool(s, &mcp.Tool{
		Name:        "list_projects",
		Description: "列出站点上的项目（slug、标题、技术栈）及各自的路线图摘要（进度、现在在做、最近完成）。写之前先确认项目 slug。需 roadmap:read。",
	}, tools.ListProjects)
	mcp.AddTool(s, &mcp.Tool{
		Name:        "get_roadmap",
		Description: "读取一个项目的完整路线图：全部条目（编号、阶段、标签、完成日期）、条目之间的关系与进度。新增前先读，避免重复条目。需 roadmap:read。",
	}, tools.GetRoadmap)
	mcp.AddTool(s, &mcp.Tool{
		Name:        "create_item",
		Description: "创建一个路线图条目，追加到目标阶段末尾（默认 planned）。已完成条目可带完成日期与交付版本。需 roadmap:write。",
	}, tools.CreateItem)
	mcp.AddTool(s, &mcp.Tool{
		Name: "create_items",
		Description: "一次创建一批条目与它们之间的关系（生成整份路线图时用，最多 50 个条目、100 条关系）。" +
			"给条目设 ref，关系的 source/target 用 ref 或已有条目的 #编号。先整体校验再创建；条目失败会停下并报告已建好的编号。需 roadmap:write。",
	}, tools.CreateItems)
	mcp.AddTool(s, &mcp.Tool{
		Name:        "update_item",
		Description: "局部更新一个条目的标题、简介、标签、链接、交付版本或完成日期：只改给出的字段。阶段与位置用 move_item。需 roadmap:write。",
	}, tools.UpdateItem)
	mcp.AddTool(s, &mcp.Tool{
		Name: "move_item",
		Description: "把条目移到另一个阶段或调整位置。after_number / before_number 指定目标阶段内的锚点，都不给则放到阶段末尾。" +
			"进入 completed 会记录完成日期（默认今天）与交付版本，离开 completed 会清空它们；已完成阶段按完成日期排序，不接受手动位置。需 roadmap:write。",
	}, tools.MoveItem)
	mcp.AddTool(s, &mcp.Tool{
		Name:        "delete_item",
		Description: "软删除一个条目（同时隐藏它的关系），返回的 item_id 可交给 restore_item 恢复。需 roadmap:write。",
	}, tools.DeleteItem)
	mcp.AddTool(s, &mcp.Tool{
		Name:        "restore_item",
		Description: "恢复被删除的条目：同编号、同位置、同内容，关系一并恢复（被显式删除的关系除外）。需 roadmap:write。",
	}, tools.RestoreItem)
	mcp.AddTool(s, &mcp.Tool{
		Name: "create_relation",
		Description: "建立两个条目之间带类型的关系，读作「来源 类型 目标」：extends（来源扩展目标）、fixes（来源修复目标）、blocks（来源阻塞目标）。" +
			"同一项目内；不能指向自己、不能重复、同一类型内不能成环。需 roadmap:write。",
	}, tools.CreateRelation)
	mcp.AddTool(s, &mcp.Tool{
		Name:        "delete_relation",
		Description: "移除一条关系。需 roadmap:write。",
	}, tools.DeleteRelation)

	return s
}
