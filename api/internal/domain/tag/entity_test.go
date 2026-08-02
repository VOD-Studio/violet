package tag

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewTag_SetsFields(t *testing.T) {
	tg := NewTag(7, "Go 语言", "go")
	assert.Equal(t, int32(7), tg.ID())
	assert.Equal(t, "Go 语言", tg.Name())
	assert.Equal(t, "go", tg.Slug())
}

func TestNewTag_AcceptsEmptyValues(t *testing.T) {
	// 构造函数不做校验（slug 由 application 层生成），零值也应原样保留
	tg := NewTag(0, "", "")
	assert.Equal(t, int32(0), tg.ID())
	assert.Empty(t, tg.Name())
	assert.Empty(t, tg.Slug())
}

func TestTag_AccessorsEchoConstructor(t *testing.T) {
	// 访问器返回构造时传入的值；不同入参产出独立实体
	cases := []struct {
		id   int32
		name string
		slug string
	}{
		{1, "Go", "go"},
		{42, "Rust 语言", "rust-lang"},
		{-1, "", ""},
	}
	for _, c := range cases {
		tg := NewTag(c.id, c.name, c.slug)
		assert.Equal(t, c.id, tg.ID())
		assert.Equal(t, c.name, tg.Name())
		assert.Equal(t, c.slug, tg.Slug())
	}
}

func TestNewTag_DistinctInstances(t *testing.T) {
	a := NewTag(1, "a", "a")
	b := NewTag(2, "b", "b")
	assert.NotEqual(t, a.ID(), b.ID())
	assert.NotEqual(t, a.Name(), b.Name())
	assert.NotEqual(t, a.Slug(), b.Slug())
}
