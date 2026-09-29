package command

import (
	"context"
	"errors"
	"testing"
)

type fakeRepo struct {
	saved OAuthCredentialsRecord
	load  OAuthCredentialsRecord
	err   error
	last  *OAuthCredentialsRecord
}

func (f *fakeRepo) Load(_ context.Context) (OAuthCredentialsRecord, error) {
	return f.load, f.err
}

func (f *fakeRepo) Save(_ context.Context, rec OAuthCredentialsRecord) error {
	if f.err != nil {
		return f.err
	}
	f.saved = rec
	f.last = &rec
	return nil
}

// 检测逻辑与部分更新语义（DB 成功路径）
func TestOAuthCredentials_Status_DetectsMissingAndMalformed(t *testing.T) {
	c := NewOAuthCredentials("", "", "", &fakeRepo{})

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
	_ = c.Update(context.Background(), OAuthCredentialUpdate{GoogleClientID: strPtr("not-a-google-id")})
	st = c.Status()
	if st.Google.Configured || st.Google.Issue == "" {
		t.Error("格式异常的 Google client_id 不应 configured")
	}

	// GitHub: 只配 id 缺 secret
	_ = c.Update(context.Background(), OAuthCredentialUpdate{GithubClientID: strPtr("Ov23li8S1SHPLyT85o6y")})
	st = c.Status()
	if st.Github.Configured {
		t.Error("缺 secret 不应 configured")
	}

	// 补齐后全部就绪
	_ = c.Update(context.Background(), OAuthCredentialUpdate{
		GoogleClientID:     strPtr("191445014130-abc.apps.googleusercontent.com"),
		GithubClientSecret: strPtr("ghp-secret"),
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

// Bootstrap：DB 非空字段覆盖 env 初值，空字段保留 env
func TestOAuthCredentials_Bootstrap_DBOverridesEnv(t *testing.T) {
	c := NewOAuthCredentials("env-google", "env-gh-id", "env-gh-secret", &fakeRepo{
		load: OAuthCredentialsRecord{GithubClientID: "db-gh-id", GithubClientSecret: "db-gh-secret"},
	})
	if err := c.Bootstrap(context.Background()); err != nil {
		t.Fatalf("Bootstrap 不应失败: %v", err)
	}
	if c.GoogleClientID() != "env-google" {
		t.Error("DB 空字段应保留 env 初值")
	}
	if c.GithubClientID() != "db-gh-id" || c.GithubClientSecret() != "db-gh-secret" {
		t.Error("DB 非空字段应覆盖 env 初值")
	}
}

// Update 落库失败必须整体失败并回滚内存（不存在半生效态）
func TestOAuthCredentials_Update_FailsAndRollsBack(t *testing.T) {
	c := NewOAuthCredentials("g", "old-id", "old-secret", &fakeRepo{})
	if err := c.Update(context.Background(), OAuthCredentialUpdate{GithubClientID: strPtr("new-id")}); err != nil {
		t.Fatalf("首次保存应成功: %v", err)
	}

	failing := &fakeRepo{err: errors.New("db down")}
	c2 := NewOAuthCredentials("g", "old-id", "old-secret", failing)
	err := c2.Update(context.Background(), OAuthCredentialUpdate{GithubClientID: strPtr("new-id")})
	if err == nil {
		t.Fatal("DB 失败应返回错误")
	}
	if c2.GithubClientID() != "old-id" {
		t.Error("DB 失败后内存必须回滚到旧值")
	}
}

// Update 成功路径把整行最新值写入 DB
func TestOAuthCredentials_Update_PersistsWholeRow(t *testing.T) {
	repo := &fakeRepo{}
	c := NewOAuthCredentials("g", "id1", "s1", repo)
	_ = c.Update(context.Background(), OAuthCredentialUpdate{GithubClientID: strPtr("id2")})
	if repo.last == nil || repo.last.GithubClientID != "id2" {
		t.Error("保存应整行落库最新值")
	}
	if repo.last.GoogleClientID != "g" || repo.last.GithubClientSecret != "s1" {
		t.Error("落库应包含未更新字段的当前值")
	}
}

func strPtr(s string) *string { return &s }
