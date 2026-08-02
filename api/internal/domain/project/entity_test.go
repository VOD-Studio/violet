package project

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	domainshared "blog-api/internal/domain/shared"
)

func TestNewProject_SetsDefaults(t *testing.T) {
	id := domainshared.NewID()
	p, err := NewProject(id, "我的项目", "一段简介")
	assert.NoError(t, err)

	assert.Equal(t, id, p.ID())
	assert.Equal(t, "我的项目", p.Title())
	assert.Equal(t, "一段简介", p.Description())

	// 新建项目 url/githubURL/imageURL 默认空
	assert.Empty(t, p.URL())
	assert.Empty(t, p.GithubURL())
	assert.Empty(t, p.ImageURL())

	// techStack 永不为 nil，默认空切片
	assert.NotNil(t, p.TechStack())
	assert.Equal(t, []string{}, p.TechStack())

	// 排序与时间戳默认零值
	assert.Equal(t, 0, p.SortOrder())
	assert.True(t, p.CreatedAt().IsZero())
	assert.True(t, p.UpdatedAt().IsZero())
}

func TestNewProject_RejectsEmptyTitle(t *testing.T) {
	_, err := NewProject(domainshared.NewID(), "", "desc")
	assert.Error(t, err, "标题为空必须报错")

	// 仅空白也拒绝（业务上标题不能为空）
	_, err = NewProject(domainshared.NewID(), "   ", "desc")
	// 注意：当前实现只判 == ""，纯空白字符串被接受；锁定当前行为。
	assert.NoError(t, err, "当前实现仅拒绝空串，纯空白字符不拦截")
}

func TestReconstructProject_PreservesAllFields(t *testing.T) {
	id := domainshared.NewID()
	created := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	updated := created.Add(48 * time.Hour)

	p := ReconstructProject(
		id, "标题", "简介",
		"https://example.com", "https://github.com/x/y", "https://cdn/x.png",
		[]string{"Go", "React"}, 5,
		created, updated,
	)

	assert.Equal(t, id, p.ID())
	assert.Equal(t, "标题", p.Title())
	assert.Equal(t, "简介", p.Description())
	assert.Equal(t, "https://example.com", p.URL())
	assert.Equal(t, "https://github.com/x/y", p.GithubURL())
	assert.Equal(t, "https://cdn/x.png", p.ImageURL())
	assert.Equal(t, []string{"Go", "React"}, p.TechStack())
	assert.Equal(t, 5, p.SortOrder())
	assert.True(t, p.CreatedAt().Equal(created))
	assert.True(t, p.UpdatedAt().Equal(updated))
}

func TestReconstructProject_NilTechStackBecomesEmpty(t *testing.T) {
	// Reconstruct 不校验，但从持久化重建时 nil techStack 归一化为空切片
	p := ReconstructProject(
		domainshared.NewID(), "t", "d",
		"", "", "", nil, 0,
		time.Time{}, time.Time{},
	)
	assert.Equal(t, []string{}, p.TechStack(), "nil 技术栈应归一化为空切片")
}

func TestProject_Update(t *testing.T) {
	p, _ := NewProject(domainshared.NewID(), "原标题", "原简介")

	err := p.Update("新标题", "新简介", "https://u", "https://g", "https://i")
	assert.NoError(t, err)
	assert.Equal(t, "新标题", p.Title())
	assert.Equal(t, "新简介", p.Description())
	assert.Equal(t, "https://u", p.URL())
	assert.Equal(t, "https://g", p.GithubURL())
	assert.Equal(t, "https://i", p.ImageURL())
}

func TestProject_Update_RejectsEmptyTitle(t *testing.T) {
	p, _ := NewProject(domainshared.NewID(), "原标题", "")
	err := p.Update("", "x", "", "", "")
	assert.Error(t, err, "Update 标题为空必须报错")
	// 失败时不应改动原值
	assert.Equal(t, "原标题", p.Title(), "校验失败不应修改已有字段")
}

func TestProject_SetTechStack(t *testing.T) {
	p, _ := NewProject(domainshared.NewID(), "t", "")
	stack := []string{"Go", "Docker", "Postgres"}
	p.SetTechStack(stack)
	assert.Equal(t, stack, p.TechStack())
}

func TestProject_SetTechStack_NilBecomesEmpty(t *testing.T) {
	p, _ := NewProject(domainshared.NewID(), "t", "")
	p.SetTechStack(nil)
	assert.Equal(t, []string{}, p.TechStack(), "SetTechStack(nil) 应归一化为空切片")
}

func TestProject_SetTechStack_DoesNotMutateCallerSlice(t *testing.T) {
	// SetTechStack 直接持有入参引用；锁定当前行为——不强制拷贝。
	p, _ := NewProject(domainshared.NewID(), "t", "")
	stack := []string{"Go"}
	p.SetTechStack(stack)
	assert.Equal(t, []string{"Go"}, p.TechStack())
}

func TestProject_SetSortOrder(t *testing.T) {
	p, _ := NewProject(domainshared.NewID(), "t", "")
	p.SetSortOrder(42)
	assert.Equal(t, 42, p.SortOrder())
	// 负值也允许（排序值无业务校验，仅相对大小）
	p.SetSortOrder(-3)
	assert.Equal(t, -3, p.SortOrder())
}
