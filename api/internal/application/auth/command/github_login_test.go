package command

import "testing"

// T1(#449)：身份匹配键只认 primary+verified 的 email。
// emails[0] 兜底曾允许未验证 email 参与账号匹配——在 GitHub 挂他人邮箱即可接管 violet 账号。
func TestPickPrimaryVerifiedEmail(t *testing.T) {
	cases := []struct {
		name  string
		emails []githubEmail
		want  string
	}{
		{
			name: "primary 且 verified 命中",
			emails: []githubEmail{
				{Email: "other@x.com", Primary: false, Verified: true},
				{Email: "me@x.com", Primary: true, Verified: true},
			},
			want: "me@x.com",
		},
		{
			name: "primary 未验证不命中（安全：未验证 email 不得作匹配键）",
			emails: []githubEmail{
				{Email: "attacker@x.com", Primary: true, Verified: false},
				{Email: "real@x.com", Primary: false, Verified: true},
			},
			want: "",
		},
		{name: "空列表", emails: nil, want: ""},
		{name: "全部未验证", emails: []githubEmail{{Email: "a@x.com", Primary: true, Verified: false}}, want: ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := pickPrimaryVerifiedEmail(tc.emails); got != tc.want {
				t.Errorf("pickPrimaryVerifiedEmail(%v) = %q, want %q", tc.emails, got, tc.want)
			}
		})
	}
}
