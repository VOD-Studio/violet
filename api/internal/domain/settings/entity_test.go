package settings

import (
	"encoding/json"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestMergeFrom_ParseBoolDefaultTrue 验证 parseBoolDefaultTrue 的边界。
// "" 和 "true" → true；其余（含 "false"、"garbage"）→ false。
func TestMergeFrom_ParseBoolDefaultTrue(t *testing.T) {
	cases := []struct {
		raw    string
		expect bool
	}{
		{"", true},
		{"true", true},
		{"false", false},
		{"1", false},
		{"yes", false},
		{"TRUE", false}, // 仅小写 "true" 命中
	}
	for _, c := range cases {
		s := SiteSettings{}.MergeFrom(map[string]string{"code_runner_enabled": c.raw})
		assert.Equal(t, c.expect, s.CodeRunnerEnabled, "code_runner_enabled=%q", c.raw)
	}
}

// TestMergeFrom_PostsPerPageParsing 验证 posts_per_page 解析：
// 合法整数覆盖默认 10；空串/非法保持默认 10。
func TestMergeFrom_PostsPerPageParsing(t *testing.T) {
	t.Run("valid_overrides_default", func(t *testing.T) {
		s := SiteSettings{}.MergeFrom(map[string]string{"posts_per_page": "25"})
		assert.Equal(t, 25, s.PostsPerPage)
	})
	t.Run("empty_keeps_default", func(t *testing.T) {
		s := SiteSettings{}.MergeFrom(map[string]string{"posts_per_page": ""})
		assert.Equal(t, 10, s.PostsPerPage)
	})
	t.Run("invalid_keeps_default", func(t *testing.T) {
		s := SiteSettings{}.MergeFrom(map[string]string{"posts_per_page": "abc"})
		assert.Equal(t, 10, s.PostsPerPage)
	})
	t.Run("zero_is_valid", func(t *testing.T) {
		// "0" 是合法数字，覆盖默认（消费方需自行处理 0）
		s := SiteSettings{}.MergeFrom(map[string]string{"posts_per_page": "0"})
		assert.Equal(t, 0, s.PostsPerPage)
	})
}

func TestMergeFrom_HomeFootprintAggregationDaysBounds(t *testing.T) {
	for _, value := range []string{"1", "7", "31"} {
		s := SiteSettings{}.MergeFrom(map[string]string{"home_footprint_aggregation_days": value})
		assert.Equal(t, value, strconv.Itoa(s.HomeFootprintAggregationDays))
	}
	for _, value := range []string{"0", "32", "invalid"} {
		s := SiteSettings{}.MergeFrom(map[string]string{"home_footprint_aggregation_days": value})
		assert.Equal(t, DefaultHomeFootprintAggregationDays, s.HomeFootprintAggregationDays)
	}
}

// TestMergeFrom_Uint64Parsing 验证 uint64 字段解析：合法→值，空/非法→0。
func TestMergeFrom_Uint64Parsing(t *testing.T) {
	t.Run("valid", func(t *testing.T) {
		s := SiteSettings{}.MergeFrom(map[string]string{
			"code_runner_max_memory_mb": "256",
		})
		assert.Equal(t, uint64(256), s.CodeRunnerMaxMemoryMB)
	})
	t.Run("empty_is_zero", func(t *testing.T) {
		s := SiteSettings{}.MergeFrom(map[string]string{"code_runner_max_memory_mb": ""})
		assert.Equal(t, uint64(0), s.CodeRunnerMaxMemoryMB)
	})
	t.Run("invalid_is_zero", func(t *testing.T) {
		s := SiteSettings{}.MergeFrom(map[string]string{"code_runner_max_memory_mb": "12abc"})
		assert.Equal(t, uint64(0), s.CodeRunnerMaxMemoryMB)
	})
	t.Run("negative_is_zero", func(t *testing.T) {
		// '-' < '0' → 非法 → 0
		s := SiteSettings{}.MergeFrom(map[string]string{"code_runner_max_memory_mb": "-1"})
		assert.Equal(t, uint64(0), s.CodeRunnerMaxMemoryMB)
	})
}

// TestMergeFrom_FloatParsing 验证 code_runner_max_cpu_cores 浮点解析。
func TestMergeFrom_FloatParsing(t *testing.T) {
	t.Run("decimal", func(t *testing.T) {
		s := SiteSettings{}.MergeFrom(map[string]string{"code_runner_max_cpu_cores": "1.75"})
		assert.Equal(t, 1.75, s.CodeRunnerMaxCPUCores)
	})
	t.Run("integer_string", func(t *testing.T) {
		s := SiteSettings{}.MergeFrom(map[string]string{"code_runner_max_cpu_cores": "4"})
		assert.Equal(t, 4.0, s.CodeRunnerMaxCPUCores)
	})
	t.Run("empty_is_zero", func(t *testing.T) {
		s := SiteSettings{}.MergeFrom(map[string]string{"code_runner_max_cpu_cores": ""})
		assert.Equal(t, 0.0, s.CodeRunnerMaxCPUCores)
	})
	t.Run("invalid_is_zero", func(t *testing.T) {
		s := SiteSettings{}.MergeFrom(map[string]string{"code_runner_max_cpu_cores": "core"})
		assert.Equal(t, 0.0, s.CodeRunnerMaxCPUCores)
	})
}

// TestMergeFrom_AboutConfig 验证 AboutConfig 仅在非空时赋值（空串保持 nil）。
func TestMergeFrom_AboutConfig(t *testing.T) {
	t.Run("non_empty", func(t *testing.T) {
		raw := `{"sections":[{"id":"bio","enabled":true}]}`
		s := SiteSettings{}.MergeFrom(map[string]string{"about_config": raw})
		assert.NotNil(t, s.AboutConfig)
		assert.JSONEq(t, raw, string(s.AboutConfig))
		// 类型为 json.RawMessage，可被 json.Marshal 透传
		out, err := json.Marshal(struct {
			C json.RawMessage `json:"about_config"`
		}{C: s.AboutConfig})
		assert.NoError(t, err)
		assert.Contains(t, string(out), raw)
	})
	t.Run("empty_is_nil", func(t *testing.T) {
		s := SiteSettings{}.MergeFrom(map[string]string{"about_config": ""})
		assert.Nil(t, s.AboutConfig)
	})
}

// TestMergeFrom_IgnoresReceiverState 验证 MergeFrom 完全基于入参 map 构造，
// 接收者既有字段不影响结果（返回 fromMap(m) 的全新实例）。
func TestMergeFrom_IgnoresReceiverState(t *testing.T) {
	preexisting := SiteSettings{
		SiteName:           "不应泄漏",
		PostsPerPage:       999,
		GithubLoginEnabled: true,
	}
	got := preexisting.MergeFrom(map[string]string{"site_url": "https://x"})
	// 接收者字段不渗入结果
	assert.Empty(t, got.SiteName, "接收者 SiteName 不应渗入结果")
	assert.Equal(t, 10, got.PostsPerPage, "接收者 PostsPerPage 不应渗入，应回到默认 10")
	assert.True(t, got.GithubLoginEnabled, "parseBoolDefaultTrue 默认 true，不受接收者影响")
	assert.Equal(t, "https://x", got.SiteURL)
	// 接收者本身不变
	assert.Equal(t, "不应泄漏", preexisting.SiteName)
}
