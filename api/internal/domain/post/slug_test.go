package post

import (
	"strings"
	"testing"
)

func TestGenerateSlug(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  string
	}{
		{"纯中文", "我的文章", "wo-de-wen-zhang"},
		{"中文+英文混排保留整词", "React 入门指南", "react-ru-men-zhi-nan"},
		{"中文+数字", "2024 年总结", "2024-nian-zong-jie"},
		{"纯英文", "Hello World", "hello-world"},
		{"中英混合带标点", "中英 mixed 标题!", "zhong-ying-mixed-biao-ti"},
		{"纯特殊字符被折叠", "@@##纯特殊字符", "chun-te-shu-zi-fu"},
		{"连续空格折叠", "a   b", "a-b"},
		{"大小写归一", "MyPost", "mypost"},
		{"下划线转连字符", "my_post", "my-post"},
		{"首尾连字符trim", "---test---", "test"},
		// 多音字取词典首音:go-pinyin 对「重」默认返回 zhong(不区分上下文),
		// 这是库固有行为,不是 bug。这里锁定实际输出防止意外漂移。
		{"多音字取词典首音", "重庆", "zhong-qing"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := GenerateSlug(tc.input)
			if got != tc.want {
				t.Errorf("GenerateSlug(%q) = %q, want %q", tc.input, got, tc.want)
			}
			// 所有用例产出必须通过 IsValidSlug 校验
			if !IsValidSlug(got) {
				t.Errorf("GenerateSlug(%q) = %q 未通过 IsValidSlug", tc.input, got)
			}
		})
	}
}

func TestGenerateSlug_EmptyFallback(t *testing.T) {
	// 空、纯空格、纯特殊字符、纯标点、纯日文(非 ASCII 非汉字)全部走 UUID 兜底
	cases := []string{"", "   ", "@#$%", "！！！", "テスト"}
	for _, input := range cases {
		got := GenerateSlug(input)
		if !strings.HasPrefix(got, "post-") {
			t.Errorf("GenerateSlug(%q) = %q, 应以 post- 兜底开头", input, got)
		}
		if !IsValidSlug(got) {
			t.Errorf("GenerateSlug(%q) 兜底 = %q 未通过 IsValidSlug", input, got)
		}
	}
}

func TestGenerateSlug_FallbackUnique(t *testing.T) {
	// 连续两次对同一空输入应产出不同的兜底(UUID 随机)
	a := GenerateSlug("")
	b := GenerateSlug("")
	if a == b {
		t.Errorf("两次空输入兜底相同 %q,UUID 应随机", a)
	}
}

func TestGenerateSlug_Truncate(t *testing.T) {
	// 构造超过 slugMaxLen 的输入,验证按 - 边界截断且长度不超限
	long := strings.Repeat("测试", 50) // 100 字 → 约 300 字符拼音
	got := GenerateSlug(long)
	if len(got) > slugMaxLen {
		t.Errorf("截断后长度 %d 超过上限 %d: %q", len(got), slugMaxLen, got)
	}
	if !IsValidSlug(got) {
		t.Errorf("截断后 %q 未通过 IsValidSlug", got)
	}
	// 截断不应以 - 结尾(trim 保证)
	if strings.HasSuffix(got, "-") {
		t.Errorf("截断后以 - 结尾: %q", got)
	}
}

func TestSplitHanSegments(t *testing.T) {
	cases := []struct {
		input string
		want  []hanSegment
	}{
		{"", nil},
		{"abc", []hanSegment{{"abc", false}}},
		{"我的", []hanSegment{{"我的", true}}},
		{"React入门", []hanSegment{{"React", false}, {"入门", true}}},
		{"入门React指南", []hanSegment{{"入门", true}, {"React", false}, {"指南", true}}},
		{"a 中 b", []hanSegment{{"a ", false}, {"中", true}, {" b", false}}},
	}
	for _, tc := range cases {
		t.Run(tc.input, func(t *testing.T) {
			got := splitHanSegments(tc.input)
			if len(got) != len(tc.want) {
				t.Fatalf("splitHanSegments(%q) = %v, want %v", tc.input, got, tc.want)
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Errorf("[%d] got %+v want %+v", i, got[i], tc.want[i])
				}
			}
		})
	}
}

func TestTruncateSlug(t *testing.T) {
	// 构造可数的超长输入:每段 4 字符(3字母+1连字符)
	// 20 段 = 80 字符,截到 slugMaxLen(60) 内最后的 -,即前 14 段完整 + 第15段的3字母
	// cut[:60] = "aaa-"×15(60字符,末尾是第15组的-),LastIndex=59,返回 cut[:59]
	const seg = "aaa-"
	input := strings.Repeat(seg, 20) // 80 字符
	want := strings.Repeat(seg, 14) + "aaa" // 14×4 + 3 = 59 字符,不以 - 结尾

	cases := []struct {
		input string
		want  string
	}{
		{"short", "short"},
		{"a-b-c-d", "a-b-c-d"},
		// 恰好 slugMaxLen 不截断
		{strings.Repeat("a", slugMaxLen), strings.Repeat("a", slugMaxLen)},
		// 超长按 - 边界截断,不以 - 结尾
		{input, want},
	}
	for _, tc := range cases {
		got := truncateSlug(tc.input)
		if got != tc.want {
			t.Errorf("truncateSlug(len=%d) = %q(len=%d), want %q(len=%d)",
				len(tc.input), got, len(got), tc.want, len(tc.want))
		}
		if len(got) > slugMaxLen {
			t.Errorf("结果长度 %d 超过上限 %d", len(got), slugMaxLen)
		}
	}
}
