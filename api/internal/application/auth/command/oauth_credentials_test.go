package command

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// OAuthCredentials 契约测试：检测逻辑、部分更新语义、.env upsert 保序保注释。
func TestOAuthCredentials_Status_DetectsMissingAndMalformed(t *testing.T) {
	c := NewOAuthCredentials("", "", "")

	st := c.Status()
	if st.Google.Configured {
		t.Error("空凭据不应 configured")
	}
	if st.Google.Issue == "" {
		t.Error("空 client_id 应有 issue 说明")
	}
	if st.Github.Configured || st.Github.Issue == "" {
		t.Error("空 GitHub 凭据应有 issue")
	}

	// Google: 格式异常的 client_id
	c.Update(OAuthCredentialUpdate{GoogleClientID: strPtr("not-a-google-id")})
	st = c.Status()
	if st.Google.Configured || st.Google.Issue == "" {
		t.Error("格式异常的 Google client_id 不应 configured")
	}

	// GitHub: 只配 id 缺 secret
	c.Update(OAuthCredentialUpdate{GithubClientID: strPtr("Ov23li8S1SHPLyT85o6y")})
	st = c.Status()
	if st.Github.Configured {
		t.Error("缺 secret 不应 configured")
	}

	// 补齐后全部就绪
	c.Update(OAuthCredentialUpdate{
		GoogleClientID:     strPtr("191445014130-abc.apps.googleusercontent.com"),
		GithubClientSecret: strPtr("ghp_secret"),
	})
	st = c.Status()
	if !st.Google.Configured || !st.Github.Configured {
		t.Error("凭据齐全应 configured")
	}
	if st.Google.ClientIDPreview == "191445014130-abc.apps.googleusercontent.com" {
		t.Error("预览应脱敏，不得全文回显")
	}
	if c.GithubClientID() != "Ov23li8S1SHPLyT85o6y" {
		t.Error("部分更新不得覆盖未更新字段")
	}
}

// upsertDotenvKeys 契约：已有键原地替换、新键追加、注释与顺序保留
func TestUpsertDotenvKeys_PreservesCommentsAndOrder(t *testing.T) {
	lines := []string{
		"# 数据库",
		"DATABASE_HOST=localhost",
		"",
		"  GITHUB_CLIENT_ID=old",
		"# OAuth",
	}
	out := upsertDotenvKeys(lines, map[string]string{
		"GITHUB_CLIENT_ID":     "new-id",
		"GOOGLE_CLIENT_ID":     "g-id",
		"GITHUB_CLIENT_SECRET": "gh-secret",
	})

	want := []string{
		"# 数据库",
		"DATABASE_HOST=localhost",
		"",
		"GITHUB_CLIENT_ID=new-id", // 缩进键也命中替换（ TrimLeft 后匹配）
		"# OAuth",
		// 新键按键名字典序追加（map 遍历序随机，排序保证输出稳定）
		"GITHUB_CLIENT_SECRET=gh-secret",
		"GOOGLE_CLIENT_ID=g-id",
	}
	if len(out) != len(want) {
		t.Fatalf("行数 = %d, want %d: %v", len(out), len(want), out)
	}
	for i := range want {
		if out[i] != want[i] {
			t.Errorf("line[%d] = %q, want %q", i, out[i], want[i])
		}
	}
}

// persistOAuthDotenv 集成：临时目录写 .env，验证文件内容与 persisted 返回值
func TestPersistOAuthDotenv_WritesFile(t *testing.T) {
	dir := t.TempDir()
	old, _ := os.Getwd()
	defer os.Chdir(old)
	if err := os.Chdir(dir); err != nil {
		t.Skipf("chdir 失败: %v", err)
	}
	if err := os.WriteFile(".env", []byte("X=1\nGITHUB_CLIENT_ID=old\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	c := NewOAuthCredentials("g.apps.googleusercontent.com", "gh-id", "gh-sec")
	if !persistOAuthDotenv(c) {
		t.Fatal("落盘应成功")
	}
	data, err := os.ReadFile(filepath.Join(dir, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	s := string(data)
	for _, want := range []string{"X=1", "GITHUB_CLIENT_ID=gh-id", "GOOGLE_CLIENT_ID=g.apps.googleusercontent.com", "GITHUB_CLIENT_SECRET=gh-sec"} {
		if !strings.Contains(s, want) {
			t.Errorf(".env 缺少 %q:\n%s", want, s)
		}
	}
}

func strPtr(s string) *string { return &s }
