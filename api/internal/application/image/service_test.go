// Package image 图片服务用例编排:查缓存 → (singleflight) → miss 调 transformer → 写缓存。
package image

import (
	"testing"

	domainimage "blog-api/internal/domain/image"
)

// --- fakes ---

// fakeTransformer 记录调用次数,返回固定结果
type fakeTransformer struct {
	calls int
}

func (f *fakeTransformer) Transform(srcPath string, params domainimage.TransformParams) (domainimage.TransformResult, error) {
	f.calls++
	return domainimage.TransformResult{Bytes: []byte("fresh"), MimeType: "image/jpeg"}, nil
}

// fakeCache 可预填数据,模拟命中
type fakeCache struct {
	store map[string]domainimage.TransformResult
}

func (f *fakeCache) Get(key string) (domainimage.TransformResult, error) {
	if v, ok := f.store[key]; ok {
		return v, nil
	}
	return domainimage.TransformResult{}, nil
}
func (f *fakeCache) Set(key string, result domainimage.TransformResult) error {
	if f.store == nil {
		f.store = map[string]domainimage.TransformResult{}
	}
	f.store[key] = result
	return nil
}

// --- tests ---

// TestServe_MissThenHit 第一次 miss 调用 transform,第二次命中缓存不再调用
func TestServe_MissThenHit(t *testing.T) {
	tr := &fakeTransformer{}
	cache := &fakeCache{store: map[string]domainimage.TransformResult{}}
	svc := NewService(tr, cache, "uploads", "/uploads/")
	params := domainimage.TransformParams{Width: 50, Format: "jpeg"}

	// 第一次:miss → 调用 transform → 回填缓存
	res, err := svc.Serve("/uploads/sample.jpg", params)
	if err != nil {
		t.Fatalf("Serve 失败: %v", err)
	}
	if tr.calls != 1 {
		t.Fatalf("未命中应调用 1 次 transform,实际 %d", tr.calls)
	}
	if string(res.Bytes) != "fresh" {
		t.Fatal("应返回 transform 结果")
	}

	// 第二次:应命中缓存,transform 不再调用
	res2, err := svc.Serve("/uploads/sample.jpg", params)
	if err != nil || tr.calls != 1 {
		t.Fatalf("第二次应命中缓存,transform 调用 %d", tr.calls)
	}
	if string(res2.Bytes) != "fresh" {
		t.Fatal("应返回缓存内容")
	}
}

// TestServe_CustomURLPrefix 验证使用非默认 upload_path_prefix 时路径映射正确
func TestServe_CustomURLPrefix(t *testing.T) {
	tr := &fakeTransformer{}
	cache := &fakeCache{store: map[string]domainimage.TransformResult{}}
	svc := NewService(tr, cache, "uploads", "/media/")
	params := domainimage.TransformParams{Width: 50, Format: "jpeg"}

	_, err := svc.Serve("/media/sample.jpg", params)
	if err != nil {
		t.Fatalf("Serve 失败: %v", err)
	}
	if tr.calls != 1 {
		t.Fatalf("自定义前缀应调用 1 次 transform,实际 %d", tr.calls)
	}

	// 旧前缀不应命中物理文件（这里仅验证不会 panic,transform 会尝试不存在的路径）
	_, _ = svc.Serve("/uploads/sample.jpg", params)
	if tr.calls != 2 {
		t.Fatalf("旧前缀不应命中缓存,应再次调用 transform,实际 %d", tr.calls)
	}
}
