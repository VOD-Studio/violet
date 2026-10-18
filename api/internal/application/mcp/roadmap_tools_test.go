package mcp

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appproject "blog-api/internal/application/project"
	approadmap "blog-api/internal/application/roadmap"
	domainapitoken "blog-api/internal/domain/api_token"
	"blog-api/internal/middleware"
)

const projectUUID = "11111111-1111-1111-1111-111111111111"

// seenIdentity 服务收到的 ctx 里的身份，验证工具把持有人的真实角色带了进去。
type seenIdentity struct {
	userID string
	role   string
	isRoot bool
}

type fakeRoadmap struct {
	detail  approadmap.DetailDTO
	nextNum int64

	seen        seenIdentity
	created     []approadmap.CreateInput
	createdIn   []string
	createErrAt int // 第几次 Create 失败（从 1 数），0 为不失败
	updated     approadmap.UpdateInput
	updatedID   string
	moved       approadmap.MoveInput
	movedID     string
	deletedID   string
	restoredID  string
	getSlug     string
	getErr      error
}

func (f *fakeRoadmap) capture(ctx context.Context) {
	f.seen = seenIdentity{
		userID: middleware.GetUserID(ctx),
		role:   middleware.GetUserRole(ctx),
		isRoot: middleware.GetUserIsRoot(ctx),
	}
}

func (f *fakeRoadmap) GetBySlug(_ context.Context, slug string) (approadmap.DetailDTO, error) {
	f.getSlug = slug
	return f.detail, f.getErr
}

func (f *fakeRoadmap) Create(ctx context.Context, projectID string, in approadmap.CreateInput) (approadmap.ItemDTO, error) {
	f.capture(ctx)
	f.created = append(f.created, in)
	f.createdIn = append(f.createdIn, projectID)
	if f.createErrAt == len(f.created) {
		return approadmap.ItemDTO{}, errors.New("标题不能为空")
	}
	f.nextNum++
	stage := in.Stage
	if stage == "" {
		stage = "planned"
	}
	return approadmap.ItemDTO{ID: fmt.Sprintf("new-%d", f.nextNum), Number: f.nextNum, Title: in.Title, Stage: stage}, nil
}

func (f *fakeRoadmap) Update(ctx context.Context, _, itemID string, in approadmap.UpdateInput) (approadmap.ItemDTO, error) {
	f.capture(ctx)
	f.updated, f.updatedID = in, itemID
	return approadmap.ItemDTO{ID: itemID, Title: in.Title}, nil
}

func (f *fakeRoadmap) Move(ctx context.Context, _, itemID string, in approadmap.MoveInput) (approadmap.ItemDTO, error) {
	f.capture(ctx)
	f.moved, f.movedID = in, itemID
	return approadmap.ItemDTO{ID: itemID, Stage: in.Stage}, nil
}

func (f *fakeRoadmap) Delete(ctx context.Context, _, itemID string) error {
	f.capture(ctx)
	f.deletedID = itemID
	return nil
}

func (f *fakeRoadmap) Restore(ctx context.Context, _, itemID string) (approadmap.ItemDTO, error) {
	f.capture(ctx)
	f.restoredID = itemID
	return approadmap.ItemDTO{ID: itemID}, nil
}

type fakeRelations struct {
	created   []approadmap.CreateRelationInput
	failFor   string // 来源 ID 等于它时失败
	deletedID string
}

func (f *fakeRelations) Create(_ context.Context, _ string, in approadmap.CreateRelationInput) (approadmap.RelationDTO, error) {
	if f.failFor != "" && in.SourceID == f.failFor {
		return approadmap.RelationDTO{}, errors.New("同一类型内不能成环")
	}
	f.created = append(f.created, in)
	return approadmap.RelationDTO{ID: fmt.Sprintf("r-%d", len(f.created)), SourceID: in.SourceID, TargetID: in.TargetID, Type: in.Type}, nil
}

func (f *fakeRelations) Delete(_ context.Context, _, relationID string) error {
	f.deletedID = relationID
	return nil
}

type fakeProjects struct{ items []appproject.ProjectDTO }

func (f *fakeProjects) List(context.Context) ([]appproject.ProjectDTO, error) { return f.items, nil }

type fakeOperators struct {
	operator Operator
	err      error
	asked    string
}

func (f *fakeOperators) Resolve(_ context.Context, userID string) (Operator, error) {
	f.asked = userID
	return f.operator, f.err
}

func item(number int64, stage string) approadmap.ItemDTO {
	return approadmap.ItemDTO{
		ID: fmt.Sprintf("item-%d", number), ProjectID: projectUUID, Number: number, Stage: stage,
		Title: fmt.Sprintf("条目 %d", number), Description: fmt.Sprintf("简介 %d", number),
		Tags: []string{"a", "b"}, Links: []approadmap.LinkDTO{{Label: "文档", URL: "https://example.com"}},
		DeliveredVersion: "v1",
	}
}

type roadmapFixture struct {
	tools     *RoadmapTools
	roadmap   *fakeRoadmap
	relations *fakeRelations
	operators *fakeOperators
}

func newRoadmapFixture() roadmapFixture {
	roadmap := &fakeRoadmap{
		nextNum: 100,
		detail: approadmap.DetailDTO{
			Project: appproject.ProjectDTO{ID: projectUUID, Slug: "violet", Title: "Violet"},
			Items: []approadmap.ItemDTO{
				item(1, "planned"), item(2, "planned"), item(3, "planned"),
				item(4, "in_progress"), item(5, "completed"),
			},
		},
	}
	relations := &fakeRelations{}
	operators := &fakeOperators{operator: Operator{Role: "editor", IsRoot: false, Active: true}}
	return roadmapFixture{
		tools:     NewRoadmapTools(roadmap, relations, &fakeProjects{}, operators),
		roadmap:   roadmap,
		relations: relations,
		operators: operators,
	}
}

func writeReq(t *testing.T) (context.Context, *mcp.CallToolRequest) {
	t.Helper()
	return context.Background(), authedReq(t, false, domainapitoken.ScopeRoadmapWrite)
}

func number(n int64) *int64 { return &n }

func TestRoadmapTools_ScopeSeparatesReadFromWrite(t *testing.T) {
	f := newRoadmapFixture()
	ctx := context.Background()
	readOnly := authedReq(t, false, domainapitoken.ScopeRoadmapRead)
	writeOnly := authedReq(t, false, domainapitoken.ScopeRoadmapWrite)
	foreign := authedReq(t, false, domainapitoken.ScopePostsWrite, domainapitoken.ScopeNotesWrite)

	res, _, err := f.tools.GetRoadmap(ctx, readOnly, getRoadmapArgs{Project: "violet"})
	require.NoError(t, err)
	assert.False(t, res.IsError, "只读令牌可以读")

	res, _, _ = f.tools.GetRoadmap(ctx, writeOnly, getRoadmapArgs{Project: "violet"})
	assert.True(t, res.IsError, "只有写 scope 不能读：两个 scope 各管各的")
	res, _, _ = f.tools.ListProjects(ctx, foreign, listRoadmapProjectsArgs{})
	assert.True(t, res.IsError, "别的域的 scope 不能越权")

	res, _, _ = f.tools.CreateItem(ctx, readOnly, createItemArgs{Project: "violet", Title: "x"})
	assert.True(t, res.IsError, "只读令牌不能写")
	assert.Empty(t, f.roadmap.created, "被拒绝时不得触达服务")
	assert.Empty(t, f.operators.asked, "被拒绝时也不必去查持有人")
}

func TestRoadmapTools_WritesCarryTheHoldersRealIdentity(t *testing.T) {
	f := newRoadmapFixture()
	f.operators.operator = Operator{Role: "maintainer", IsRoot: true, Active: true}
	ctx, req := writeReq(t)

	res, _, err := f.tools.CreateItem(ctx, req, createItemArgs{Project: "violet", Title: "新条目"})

	require.NoError(t, err)
	require.False(t, res.IsError)
	assert.Equal(t, "u-1", f.operators.asked)
	assert.Equal(t, seenIdentity{userID: "u-1", role: "maintainer", isRoot: true}, f.roadmap.seen,
		"服务按 project:update 判断时看到的是持有人的真实角色，而不是 PAT 的 scope")
	assert.Equal(t, projectUUID, f.roadmap.createdIn[0], "slug 解析成项目 UUID")
}

func TestRoadmapTools_RejectsDeactivatedHolderAndResolverFailure(t *testing.T) {
	f := newRoadmapFixture()
	ctx, req := writeReq(t)
	f.operators.operator = Operator{Role: "editor", Active: false}

	res, _, _ := f.tools.CreateItem(ctx, req, createItemArgs{Project: "violet", Title: "x"})
	assert.True(t, res.IsError)
	assert.Contains(t, textOf(t, res), "已停用")

	f.operators.err = errors.New("db down")
	res, _, _ = f.tools.CreateItem(ctx, req, createItemArgs{Project: "violet", Title: "x"})
	assert.True(t, res.IsError)
	assert.Contains(t, textOf(t, res), "读取令牌持有人失败")
	assert.Empty(t, f.roadmap.created)
}

func TestRoadmapTools_ProjectMustBeNamedAndExist(t *testing.T) {
	f := newRoadmapFixture()
	ctx, req := writeReq(t)

	res, _, _ := f.tools.CreateItem(ctx, req, createItemArgs{Project: "  ", Title: "x"})
	assert.True(t, res.IsError)
	assert.Contains(t, textOf(t, res), "list_projects")

	f.roadmap.getErr = errors.New("项目不存在")
	res, _, _ = f.tools.CreateItem(ctx, req, createItemArgs{Project: "nope", Title: "x"})
	assert.True(t, res.IsError)
	assert.Equal(t, "nope", f.roadmap.getSlug)
	assert.Empty(t, f.roadmap.created)
}

func TestRoadmapTools_ItemIsFoundByNumberOrIDExactlyOne(t *testing.T) {
	f := newRoadmapFixture()
	ctx, req := writeReq(t)
	title := "新标题"

	res, _, _ := f.tools.UpdateItem(ctx, req, updateItemArgs{Project: "violet", Number: number(2), Title: &title})
	require.False(t, res.IsError)
	assert.Equal(t, "item-2", f.roadmap.updatedID)

	res, _, _ = f.tools.UpdateItem(ctx, req, updateItemArgs{Project: "violet", ItemID: "item-3", Title: &title})
	require.False(t, res.IsError)
	assert.Equal(t, "item-3", f.roadmap.updatedID)

	for name, args := range map[string]updateItemArgs{
		"编号不存在":  {Project: "violet", Number: number(99)},
		"ID 不存在": {Project: "violet", ItemID: "ghost"},
		"两个都给":   {Project: "violet", Number: number(1), ItemID: "item-1"},
		"两个都不给":  {Project: "violet"},
	} {
		res, _, _ = f.tools.UpdateItem(ctx, req, args)
		assert.True(t, res.IsError, name)
	}
}

func TestRoadmapTools_UpdateOnlyChangesTheGivenFields(t *testing.T) {
	f := newRoadmapFixture()
	ctx, req := writeReq(t)
	title := "只改标题"

	res, _, _ := f.tools.UpdateItem(ctx, req, updateItemArgs{Project: "violet", Number: number(1), Title: &title})

	require.False(t, res.IsError)
	assert.Equal(t, approadmap.UpdateInput{
		Title: "只改标题", Description: "简介 1", Tags: []string{"a", "b"},
		Links:            []approadmap.LinkDTO{{Label: "文档", URL: "https://example.com"}},
		DeliveredVersion: "v1",
	}, f.roadmap.updated, "没给的字段沿用原值，不能被全量替换清空")
}

func TestRoadmapTools_UpdateCanClearWithEmptyValues(t *testing.T) {
	f := newRoadmapFixture()
	ctx, req := writeReq(t)
	empty := ""
	date := "2026-10-20"

	res, _, _ := f.tools.UpdateItem(ctx, req, updateItemArgs{
		Project: "violet", Number: number(5), Description: &empty, Tags: []string{},
		Links: []roadmapLinkArg{}, DeliveredVersion: &empty, CompletionDate: &date,
	})

	require.False(t, res.IsError)
	assert.Equal(t, "", f.roadmap.updated.Description)
	assert.Empty(t, f.roadmap.updated.Tags)
	assert.Empty(t, f.roadmap.updated.Links)
	assert.Equal(t, "", f.roadmap.updated.DeliveredVersion)
	require.NotNil(t, f.roadmap.updated.CompletionDate)
	assert.Equal(t, date, *f.roadmap.updated.CompletionDate)
}

func TestRoadmapTools_MoveComputesNeighborsFromAnAnchor(t *testing.T) {
	cases := []struct {
		name           string
		args           moveItemArgs
		previous, next string
	}{
		{"放到阶段末尾", moveItemArgs{Number: number(4), Stage: "planned"}, "", ""},
		{"放在 #2 之后", moveItemArgs{Number: number(4), Stage: "planned", AfterNumber: number(2)}, "item-2", "item-3"},
		{"放在最后一条之后", moveItemArgs{Number: number(4), Stage: "planned", AfterNumber: number(3)}, "item-3", ""},
		{"放在 #1 之前", moveItemArgs{Number: number(4), Stage: "planned", BeforeNumber: number(1)}, "", "item-1"},
		{"放在 #3 之前", moveItemArgs{Number: number(4), Stage: "planned", BeforeNumber: number(3)}, "item-2", "item-3"},
		{"同阶段内挪动时不把自己当邻居", moveItemArgs{Number: number(1), Stage: "planned", AfterNumber: number(2)}, "item-2", "item-3"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newRoadmapFixture()
			ctx, req := writeReq(t)
			tc.args.Project = "violet"

			res, _, _ := f.tools.MoveItem(ctx, req, tc.args)

			require.False(t, res.IsError, textOf(t, res))
			assert.Equal(t, tc.previous, f.roadmap.moved.BeforeID, "BeforeID 是目标位置的上一条")
			assert.Equal(t, tc.next, f.roadmap.moved.AfterID, "AfterID 是目标位置的下一条")
			assert.Equal(t, tc.args.Stage, f.roadmap.moved.Stage)
		})
	}
}

func TestRoadmapTools_MoveRejectsAmbiguousOrWrongAnchors(t *testing.T) {
	f := newRoadmapFixture()
	ctx, req := writeReq(t)

	res, _, _ := f.tools.MoveItem(ctx, req, moveItemArgs{
		Project: "violet", Number: number(4), Stage: "planned", AfterNumber: number(1), BeforeNumber: number(2),
	})
	assert.True(t, res.IsError, "两个锚点只能给一个")

	res, _, _ = f.tools.MoveItem(ctx, req, moveItemArgs{
		Project: "violet", Number: number(4), Stage: "planned", AfterNumber: number(5),
	})
	assert.True(t, res.IsError, "锚点不在目标阶段里")
	assert.Contains(t, textOf(t, res), "#5")
	assert.Empty(t, f.roadmap.movedID)
}

func TestRoadmapTools_MoveIntoCompletedPassesDateAndVersion(t *testing.T) {
	f := newRoadmapFixture()
	ctx, req := writeReq(t)
	date := "2026-10-18"

	res, _, _ := f.tools.MoveItem(ctx, req, moveItemArgs{
		Project: "violet", Number: number(4), Stage: "completed", CompletionDate: &date, DeliveredVersion: "v2.0.0",
	})

	require.False(t, res.IsError)
	require.NotNil(t, f.roadmap.moved.CompletionDate)
	assert.Equal(t, date, *f.roadmap.moved.CompletionDate)
	assert.Equal(t, "v2.0.0", f.roadmap.moved.DeliveredVersion)
}

func TestRoadmapTools_DeleteReturnsTheIDForRestore(t *testing.T) {
	f := newRoadmapFixture()
	ctx, req := writeReq(t)

	res, _, _ := f.tools.DeleteItem(ctx, req, deleteItemArgs{Project: "violet", Number: number(2)})
	require.False(t, res.IsError)
	assert.Equal(t, "item-2", f.roadmap.deletedID)
	assert.Contains(t, textOf(t, res), `"item_id":"item-2"`)

	res, _, _ = f.tools.RestoreItem(ctx, req, restoreItemArgs{Project: "violet", ItemID: " item-2 "})
	require.False(t, res.IsError)
	assert.Equal(t, "item-2", f.roadmap.restoredID)
}

func TestRoadmapTools_RelationsResolveNumbersToIDs(t *testing.T) {
	f := newRoadmapFixture()
	ctx, req := writeReq(t)

	res, _, _ := f.tools.CreateRelation(ctx, req, createRelationArgs{Project: "violet", SourceNumber: 1, TargetNumber: 4, Type: "blocks"})
	require.False(t, res.IsError)
	assert.Equal(t, []approadmap.CreateRelationInput{{SourceID: "item-1", TargetID: "item-4", Type: "blocks"}}, f.relations.created)

	res, _, _ = f.tools.CreateRelation(ctx, req, createRelationArgs{Project: "violet", SourceNumber: 1, TargetNumber: 77, Type: "blocks"})
	assert.True(t, res.IsError)

	res, _, _ = f.tools.DeleteRelation(ctx, req, deleteRelationArgs{Project: "violet", RelationID: " r-9 "})
	require.False(t, res.IsError)
	assert.Equal(t, "r-9", f.relations.deletedID)
}

func TestRoadmapTools_CreateItemsBuildsItemsThenRelationsByRef(t *testing.T) {
	f := newRoadmapFixture()
	ctx, req := writeReq(t)
	done := "2026-10-01"

	res, _, _ := f.tools.CreateItems(ctx, req, createItemsArgs{
		Project: "violet",
		Items: []batchItemArg{
			{Ref: "api", Title: "后端接口", Stage: "completed", CompletionDate: &done, DeliveredVersion: "v1"},
			{Ref: "ui", Title: "前端页面", Stage: "in_progress", Tags: []string{"web"}},
			{Title: "没有 ref 的条目"},
		},
		Relations: []batchRelationArg{
			{Source: "ui", Target: "api", Type: "extends"},
			{Source: "ui", Target: "#3", Type: "blocks"},
			{Source: " api ", Target: "ui", Type: "fixes"},
		},
	})

	require.False(t, res.IsError, textOf(t, res))
	require.Len(t, f.roadmap.created, 3)
	assert.Equal(t, []string{"后端接口", "前端页面", "没有 ref 的条目"}, []string{f.roadmap.created[0].Title, f.roadmap.created[1].Title, f.roadmap.created[2].Title}, "按数组顺序创建")
	assert.Equal(t, "completed", f.roadmap.created[0].Stage)
	assert.Equal(t, []approadmap.CreateRelationInput{
		{SourceID: "new-102", TargetID: "new-101", Type: "extends"},
		{SourceID: "new-102", TargetID: "item-3", Type: "blocks"},
		{SourceID: "new-101", TargetID: "new-102", Type: "fixes"},
	}, f.relations.created, "ref 指向本批新建的条目，#N 指向已有条目")
	assert.Contains(t, textOf(t, res), `"relation_errors":[]`)
}

func TestRoadmapTools_CreateItemsValidatesBeforeCreatingAnything(t *testing.T) {
	cases := map[string]createItemsArgs{
		"没有条目":       {Project: "violet"},
		"ref 重复":     {Project: "violet", Items: []batchItemArg{{Ref: "a", Title: "1"}, {Ref: "a", Title: "2"}}},
		"关系指向未知 ref": {Project: "violet", Items: []batchItemArg{{Ref: "a", Title: "1"}}, Relations: []batchRelationArg{{Source: "a", Target: "ghost", Type: "extends"}}},
		"关系指向未知编号":   {Project: "violet", Items: []batchItemArg{{Ref: "a", Title: "1"}}, Relations: []batchRelationArg{{Source: "a", Target: "#99", Type: "extends"}}},
		"条目太多":       {Project: "violet", Items: make([]batchItemArg, maxBatchItems+1)},
		"关系太多":       {Project: "violet", Items: []batchItemArg{{Title: "1"}}, Relations: make([]batchRelationArg, maxBatchRelations+1)},
	}
	for name, args := range cases {
		t.Run(name, func(t *testing.T) {
			f := newRoadmapFixture()
			ctx, req := writeReq(t)

			res, _, _ := f.tools.CreateItems(ctx, req, args)

			assert.True(t, res.IsError)
			assert.Empty(t, f.roadmap.created, "整体校验不过就一个都不建")
		})
	}
}

func TestRoadmapTools_CreateItemsStopsAtTheFirstFailedItemAndReportsWhatExists(t *testing.T) {
	f := newRoadmapFixture()
	f.roadmap.createErrAt = 3
	ctx, req := writeReq(t)

	res, _, _ := f.tools.CreateItems(ctx, req, createItemsArgs{
		Project:   "violet",
		Items:     []batchItemArg{{Ref: "a", Title: "一"}, {Ref: "b", Title: "二"}, {Ref: "c", Title: ""}, {Ref: "d", Title: "四"}},
		Relations: []batchRelationArg{{Source: "a", Target: "b", Type: "extends"}},
	})

	require.True(t, res.IsError)
	message := textOf(t, res)
	assert.Contains(t, message, "第 3 个条目")
	assert.Contains(t, message, "#101、#102", "告诉调用方已经建好了哪些编号，修正后只提交剩下的")
	assert.Len(t, f.roadmap.created, 3, "失败后不再继续创建")
	assert.Empty(t, f.relations.created, "条目没建完不建关系")
}

func TestRoadmapTools_CreateItemsReportsFailedRelationsWithoutLosingTheRest(t *testing.T) {
	f := newRoadmapFixture()
	f.relations.failFor = "new-101"
	ctx, req := writeReq(t)

	res, _, _ := f.tools.CreateItems(ctx, req, createItemsArgs{
		Project: "violet",
		Items:   []batchItemArg{{Ref: "a", Title: "一"}, {Ref: "b", Title: "二"}},
		Relations: []batchRelationArg{
			{Source: "a", Target: "b", Type: "extends"},
			{Source: "b", Target: "a", Type: "extends"},
		},
	})

	require.False(t, res.IsError, "关系失败不应让已创建的条目看起来像整体失败")
	text := textOf(t, res)
	assert.Contains(t, text, "同一类型内不能成环")
	assert.Len(t, f.relations.created, 1)
}

func TestRoadmapTools_ReadToolsReturnProjectsAndTheFullRoadmap(t *testing.T) {
	f := newRoadmapFixture()
	f.tools.projects = &fakeProjects{items: []appproject.ProjectDTO{{ID: projectUUID, Slug: "violet", Title: "Violet"}}}
	ctx := context.Background()
	req := authedReq(t, false, domainapitoken.ScopeRoadmapRead)

	res, _, _ := f.tools.ListProjects(ctx, req, listRoadmapProjectsArgs{})
	require.False(t, res.IsError)
	assert.Contains(t, textOf(t, res), `"slug":"violet"`)

	res, _, _ = f.tools.GetRoadmap(ctx, req, getRoadmapArgs{Project: " violet "})
	require.False(t, res.IsError)
	assert.Equal(t, "violet", f.roadmap.getSlug, "slug 去首尾空白")
	assert.Contains(t, textOf(t, res), `"number":5`)
}

func TestNewRoadmapServer_RegistersAllToolsWithoutPanic(t *testing.T) {
	server := NewRoadmapServer(NewRoadmapTools(nil, nil, nil, nil))

	require.NotNil(t, server, "10 个 tool 的参数 schema 推导不应 panic")
	assert.True(t, strings.Contains(roadmapInstructions, "roadmap:write"))
}
