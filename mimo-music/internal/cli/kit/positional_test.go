package kit

import (
	"errors"
	"strings"
	"testing"
)

func TestResolveID(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name    string
		flagID  int64
		args    []string
		want    int64
		wantErr bool
		errMsg  string
	}{
		{"仅 flag", 347230, nil, 347230, false, ""},
		{"仅 flag 空args", 347230, []string{}, 347230, false, ""},
		{"仅位置参数", 0, []string{"347230"}, 347230, false, ""},
		{"位置参数空串视为无", 347230, []string{""}, 347230, false, ""},
		{"flag 与位置冲突", 100, []string{"200"}, 0, true, "不能同时指定"},
		{"两者都缺_flag0_args空", 0, nil, 0, true, "缺少 id"},
		{"两者都缺_flag0_空串args", 0, []string{""}, 0, true, "缺少 id"},
		{"位置参数非数字", 0, []string{"abc"}, 0, true, "不是合法 id"},
		{"位置参数负数", 0, []string{"-5"}, -5, false, ""}, // 负数是合法 int64,解析通过(语义校验留给业务)
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := ResolveID(tc.flagID, tc.args)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("应报错, got nil")
				}
				if !errors.Is(err, ErrUsage) {
					t.Errorf("应 ErrUsage(exit 2), got %v", err)
				}
				if tc.errMsg != "" && !strings.Contains(err.Error(), tc.errMsg) {
					t.Errorf("错误应含 %q, got %q", tc.errMsg, err.Error())
				}
				return
			}
			if err != nil {
				t.Fatalf("不应报错, got %v", err)
			}
			if got != tc.want {
				t.Errorf("ResolveID = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestResolveKeyword(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name        string
		flagKeyword string
		args        []string
		want        string
		wantErr     bool
	}{
		{"仅 flag", "周杰伦", nil, "周杰伦", false},
		{"仅位置参数", "", []string{"周杰伦"}, "周杰伦", false},
		{"位置参数带空格", "", []string{"Jay Chou"}, "Jay Chou", false},
		{"两者都给-歧义", "周杰伦", []string{"林俊杰"}, "", true},
		{"两者都缺", "", nil, "", true},
		{"空字符串位置参数视为无", "周杰伦", []string{""}, "周杰伦", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ResolveKeyword(tc.flagKeyword, tc.args)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("应报错, got nil")
				}
				if !errors.Is(err, ErrUsage) {
					t.Errorf("错误应包装 ErrUsage, got %v", err)
				}
				return
			}
			if err != nil {
				t.Fatalf("不应报错, got %v", err)
			}
			if got != tc.want {
				t.Errorf("ResolveKeyword = %q, want %q", got, tc.want)
			}
		})
	}
}
