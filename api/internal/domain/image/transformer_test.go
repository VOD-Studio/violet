package image

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTransformParams_KeySerializesAllFields(t *testing.T) {
	p := TransformParams{
		Width: 800, Height: 600,
		ThumbW: 200, ThumbH: 150,
		Rotate: 90, Format: "webp", Quality: 80,
	}
	assert.Equal(t, "w800_h600_tw200_th150_r90_webp_q80", p.Key())
}

func TestTransformParams_KeyZeroDefaults(t *testing.T) {
	// 零值参数：全部为 0 / 空串，Key 仍稳定序列化
	p := TransformParams{}
	assert.Equal(t, "w0_h0_tw0_th0_r0__q0", p.Key())
}

func TestTransformParams_KeyDifferentiatesParams(t *testing.T) {
	base := TransformParams{
		Width: 100, Height: 100, ThumbW: 50, ThumbH: 50,
		Rotate: 0, Format: "png", Quality: 90,
	}
	baseKey := base.Key()

	cases := []struct {
		name   string
		mutate func(TransformParams) TransformParams
	}{
		{"width", func(p TransformParams) TransformParams { p.Width = 200; return p }},
		{"height", func(p TransformParams) TransformParams { p.Height = 200; return p }},
		{"thumbW", func(p TransformParams) TransformParams { p.ThumbW = 99; return p }},
		{"thumbH", func(p TransformParams) TransformParams { p.ThumbH = 99; return p }},
		{"rotate", func(p TransformParams) TransformParams { p.Rotate = 180; return p }},
		{"format", func(p TransformParams) TransformParams { p.Format = "webp"; return p }},
		{"quality", func(p TransformParams) TransformParams { p.Quality = 10; return p }},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			changed := c.mutate(base)
			assert.NotEqual(t, baseKey, changed.Key(),
				"改变 %s 后 Key 必须不同，否则缓存会串", c.name)
			// 同样的变更两次应得到相同的 Key（确定性）
			again := c.mutate(base)
			assert.Equal(t, changed.Key(), again.Key(), "Key 必须确定")
		})
	}
}

func TestTransformParams_NoValidationByDesign(t *testing.T) {
	// TransformParams 是纯数据载体，domain 层不做 quality/rotate/format 范围校验
	// （由 application/infrastructure 层在真正处理时拦截）。锁定当前行为：
	// 任何显式值都能构造，且 Key 可稳定生成。
	odd := TransformParams{Quality: 0}
	assert.Equal(t, 0, odd.Quality)
	assert.Equal(t, "w0_h0_tw0_th0_r0__q0", odd.Key())

	over := TransformParams{Quality: 999, Rotate: 45, Format: "bogus"}
	assert.Equal(t, 999, over.Quality)
	assert.Equal(t, "w0_h0_tw0_th0_r45_bogus_q999", over.Key())
}

func TestTransformResult_HoldsFields(t *testing.T) {
	bytes := []byte{0x89, 0x50, 0x4E, 0x47} // PNG magic
	r := TransformResult{
		Bytes:    bytes,
		MimeType: "image/png",
		ETag:     `"abc123"`,
	}
	assert.Equal(t, bytes, r.Bytes)
	assert.Equal(t, "image/png", r.MimeType)
	assert.Equal(t, `"abc123"`, r.ETag)
}

func TestTransformResult_ZeroValue(t *testing.T) {
	// 缓存未命中时返回零值（Bytes == nil）；锁定契约
	var r TransformResult
	assert.Nil(t, r.Bytes)
	assert.Empty(t, r.MimeType)
	assert.Empty(t, r.ETag)
}
