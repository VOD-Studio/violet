package coderunner

import (
	"testing"
)

func TestIsValidLanguage(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		lang string
		want bool
	}{
		{"python", "python", true},
		{"node", "node", true},
		{"go", "go", true},
		{"rust", "rust", true},
		{"bun", "bun", true},
		{"大小写不敏感", "Python", true},
		{"前后空白容忍", "  RUST  ", true},
		{"未注册语言", "ruby", false},
		{"空串", "", false},
		{"命令注入尝试", "python; rm -rf /", false},
		{"多 token", "python node", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := IsValidLanguage(tc.lang); got != tc.want {
				t.Errorf("IsValidLanguage(%q) = %v, want %v", tc.lang, got, tc.want)
			}
		})
	}
}

func TestIsValidStatus(t *testing.T) {
	t.Parallel()
	valid := []string{StatusQueued, StatusRunning, StatusSuccess, StatusError, StatusTimeout, StatusOomKilled, StatusFailed}
	for _, s := range valid {
		if !IsValidStatus(s) {
			t.Errorf("IsValidStatus(%q) 应为 true", s)
		}
	}
	if IsValidStatus("unknown") {
		t.Errorf("IsValidStatus(unknown) 应为 false")
	}
}

func TestIsTerminalStatus(t *testing.T) {
	t.Parallel()
	terminal := []string{StatusSuccess, StatusError, StatusTimeout, StatusOomKilled, StatusFailed}
	for _, s := range terminal {
		if !IsTerminalStatus(s) {
			t.Errorf("IsTerminalStatus(%q) 应为 true", s)
		}
	}
	nonTerminal := []string{StatusQueued, StatusRunning}
	for _, s := range nonTerminal {
		if IsTerminalStatus(s) {
			t.Errorf("IsTerminalStatus(%q) 应为 false", s)
		}
	}
}
