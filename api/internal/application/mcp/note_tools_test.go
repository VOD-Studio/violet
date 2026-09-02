package mcp

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appnote "blog-api/internal/application/note"
	apptag "blog-api/internal/application/tag"
	domainapitoken "blog-api/internal/domain/api_token"
	domainnote "blog-api/internal/domain/note"
)

// fakeNoteToolsService 记录调用的最小桩。
type fakeNoteToolsService struct {
	createInput appnote.CreateInput
	createErr   error
	publishID   string
	updateInput appnote.UpdateInput
	listQuery   appnote.ListQuery
	getID       string
	deleteID    string
}

func (f *fakeNoteToolsService) Create(_ context.Context, in appnote.CreateInput) (appnote.NoteDTO, error) {
	f.createInput = in
	if f.createErr != nil {
		return appnote.NoteDTO{}, f.createErr
	}
	return appnote.NoteDTO{ID: "n1", Status: domainnote.StatusDraft, Tags: []string{}}, nil
}

func (f *fakeNoteToolsService) Update(_ context.Context, in appnote.UpdateInput) (appnote.NoteDTO, error) {
	f.updateInput = in
	return appnote.NoteDTO{ID: in.NoteID, Tags: []string{}}, nil
}

func (f *fakeNoteToolsService) Get(_ context.Context, id string) (appnote.NoteDTO, error) {
	f.getID = id
	return appnote.NoteDTO{ID: id, Tags: []string{}}, nil
}

func (f *fakeNoteToolsService) List(_ context.Context, q appnote.ListQuery) ([]appnote.NoteSummaryDTO, int64, error) {
	f.listQuery = q
	return nil, 0, nil
}

func (f *fakeNoteToolsService) Publish(_ context.Context, id string) (appnote.NoteDTO, error) {
	f.publishID = id
	return appnote.NoteDTO{ID: id, Status: domainnote.StatusPublished}, nil
}

func (f *fakeNoteToolsService) Delete(_ context.Context, id string) error {
	f.deleteID = id
	return nil
}

// fakeTagEnsure 记录被创建的标签名。
type fakeTagEnsure struct{ created []string }

func (f *fakeTagEnsure) CreateOrGet(_ context.Context, name string) (apptag.TagDTO, error) {
	f.created = append(f.created, name)
	return apptag.TagDTO{}, nil
}

func newNoteToolsForTest() (*NoteTools, *fakeNoteToolsService, *fakeTagEnsure) {
	notes := &fakeNoteToolsService{}
	tags := &fakeTagEnsure{}
	return NewNoteTools(notes, tags), notes, tags
}

func TestNoteTools_CreateNote_DraftRequiresWriteOnly(t *testing.T) {
	tools, notes, tags := newNoteToolsForTest()
	req := authedReq(t, false, domainapitoken.ScopeNotesWrite)

	res, _, err := tools.CreateNote(context.Background(), req, createNoteArgs{
		ContentMD: "# 现象\n正文", Tags: []string{"redis", "redis", " "},
	})
	require.NoError(t, err)
	require.False(t, res.IsError)
	assert.Equal(t, "u-1", notes.createInput.UserID, "作者一律取 PAT 持有人")
	assert.Equal(t, []string{"redis", "redis", " "}, notes.createInput.Tags)
	assert.Equal(t, []string{"redis"}, dedupe(tags.created), "标签自动创建应去空白去空项")
	assert.Empty(t, notes.publishID, "默认 draft 不应触发发布")
}

func TestNoteTools_CreateNote_PublishedRequiresPublishScope(t *testing.T) {
	tools, _, _ := newNoteToolsForTest()

	// 只有 write：直发被拒
	res, _, err := tools.CreateNote(context.Background(),
		authedReq(t, false, domainapitoken.ScopeNotesWrite),
		createNoteArgs{ContentMD: "x", Status: "published"})
	require.NoError(t, err)
	require.True(t, res.IsError, "缺 notes:publish 时直发必须拒绝")

	// write + publish：直发成功且触发 Publish
	tools2, notes2, _ := newNoteToolsForTest()
	res2, _, err := tools2.CreateNote(context.Background(),
		authedReq(t, false, domainapitoken.ScopeNotesWrite, domainapitoken.ScopeNotesPublish),
		createNoteArgs{ContentMD: "x", Status: "published"})
	require.NoError(t, err)
	require.False(t, res2.IsError)
	assert.Equal(t, "n1", notes2.publishID)
}

func TestNoteTools_CreateNote_InvalidStatus(t *testing.T) {
	tools, _, _ := newNoteToolsForTest()
	res, _, err := tools.CreateNote(context.Background(),
		authedReq(t, false, domainapitoken.ScopeNotesWrite),
		createNoteArgs{ContentMD: "x", Status: "archived"})
	require.NoError(t, err)
	require.True(t, res.IsError)
}

func TestNoteTools_CreateNote_MissingScopeRejected(t *testing.T) {
	tools, _, _ := newNoteToolsForTest()
	res, _, err := tools.CreateNote(context.Background(),
		authedReq(t, false, domainapitoken.ScopePostsWrite),
		createNoteArgs{ContentMD: "x"})
	require.NoError(t, err)
	require.True(t, res.IsError, "posts scope 不得越权建笔记")
}

func TestNoteTools_UpdateNote_BlankContentRejected(t *testing.T) {
	tools, _, _ := newNoteToolsForTest()
	res, _, err := tools.UpdateNote(context.Background(),
		authedReq(t, false, domainapitoken.ScopeNotesWrite),
		updateNoteArgs{ID: "n1", ContentMD: "  "})
	require.NoError(t, err)
	require.True(t, res.IsError, "全量替换语义下 content_md 必填")
}

func TestNoteTools_ListNotes_AuthorIsTokenHolder(t *testing.T) {
	tools, notes, _ := newNoteToolsForTest()
	res, _, err := tools.ListNotes(context.Background(),
		authedReq(t, false, domainapitoken.ScopeNotesRead),
		listNotesArgs{Status: "draft"})
	require.NoError(t, err)
	require.False(t, res.IsError)
	assert.Equal(t, "u-1", notes.listQuery.Author, "作者视角固定为 PAT 持有人")
	assert.Equal(t, "draft", notes.listQuery.Status)
}

func TestNoteTools_DeleteAndGet_ScopeGates(t *testing.T) {
	tools, notes, _ := newNoteToolsForTest()

	// 无 scope 拒绝
	res, _, err := tools.DeleteNote(context.Background(), authedReq(t, false), deleteNoteArgs{ID: "n1"})
	require.NoError(t, err)
	require.True(t, res.IsError)

	// notes:read 不够删（需要 write）
	res2, _, _ := tools.DeleteNote(context.Background(),
		authedReq(t, false, domainapitoken.ScopeNotesRead), deleteNoteArgs{ID: "n1"})
	require.True(t, res2.IsError)

	res3, _, err := tools.DeleteNote(context.Background(),
		authedReq(t, false, domainapitoken.ScopeNotesWrite), deleteNoteArgs{ID: "n1"})
	require.NoError(t, err)
	require.False(t, res3.IsError)
	assert.Equal(t, "n1", notes.deleteID)

	res4, _, err := tools.GetNote(context.Background(),
		authedReq(t, false, domainapitoken.ScopeNotesRead), getNoteArgs{ID: "n2"})
	require.NoError(t, err)
	require.False(t, res4.IsError)
	assert.Equal(t, "n2", notes.getID)
}

func dedupe(in []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(in))
	for _, s := range in {
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	return out
}

var _ NoteWritingService = (*fakeNoteToolsService)(nil)
var _ TagEnsureService = (*fakeTagEnsure)(nil)
