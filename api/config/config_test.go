package config

import (
	"testing"
	"time"

	"github.com/spf13/viper"
)

// getStringSlice 必须兼容 env 的逗号分隔写法:
// viper AutomaticEnv 对 CORS_ALLOWED_ORIGINS=https://a.com,https://b.com
// 只会包装为单元素,不切分——这里契约是「单元素且含逗号 → 切分并去空白」。
func TestGetStringSlice(t *testing.T) {
	t.Run("yaml 原生列表原样返回", func(t *testing.T) {
		v := viper.New()
		v.Set("key", []string{"https://a.com", "https://b.com"})
		got := getStringSlice(v, "key")
		if len(got) != 2 || got[0] != "https://a.com" || got[1] != "https://b.com" {
			t.Fatalf("got %v", got)
		}
	})

	t.Run("env 逗号分隔切分并去空白", func(t *testing.T) {
		v := viper.New()
		v.Set("key", "https://a.com, https://b.com ,https://c.com")
		got := getStringSlice(v, "key")
		if len(got) != 3 || got[0] != "https://a.com" || got[1] != "https://b.com" || got[2] != "https://c.com" {
			t.Fatalf("got %v", got)
		}
	})

	t.Run("单值不含逗号不切分", func(t *testing.T) {
		v := viper.New()
		v.Set("key", "https://a.com/path?x=1")
		got := getStringSlice(v, "key")
		if len(got) != 1 || got[0] != "https://a.com/path?x=1" {
			t.Fatalf("got %v", got)
		}
	})
}

// maskValue 契约:敏感键(password/secret/cookies/token/api_key)脱敏;
// cookie.csrf_name 等非敏感键不得被「cookie」子串误伤(历史回归);
// 空值统一标注 (empty)。
func TestMaskValue(t *testing.T) {
	cases := []struct {
		key   string
		value any
		want  string
	}{
		{"database.password", "super@123", "***"},
		{"github_client_secret", "abc", "***"},
		{"bilibili_cookies", "SESSDATA=x", "***"},
		{"resend_api_key", "re_123", "***"},
		{"resource_signing_key", "cursor-signing-secret", "***"},
		{"cookie.csrf_name", "violet_csrf", "violet_csrf"},
		{"cookie.session_name", "violet_session", "violet_session"},
		{"cookie.secure", false, "false"},
		{"database.host", "localhost", "localhost"},
		{"redis.password", "", "(empty)"},
	}
	for _, c := range cases {
		if got := maskValue(c.key, c.value); got != c.want {
			t.Errorf("maskValue(%q, %v) = %q, want %q", c.key, c.value, got, c.want)
		}
	}
}

func TestValidateRequiresStrongResourceSigningKeyInProduction(t *testing.T) {
	cfg := validTestConfig()
	cfg.Environment = "production"
	cfg.Cookie.Secure = true
	cfg.CORSAllowedOrigins = []string{"https://example.com"}
	cfg.ResourceSigningKey = "short"
	if err := cfg.Validate(); err == nil {
		t.Fatal("生产环境短签名密钥应校验失败")
	}
	cfg.ResourceSigningKey = "0123456789abcdef0123456789abcdef"
	if err := cfg.Validate(); err != nil {
		t.Fatalf("32 字节签名密钥应通过校验: %v", err)
	}
}

func validTestConfig() Config {
	return Config{
		Database: DatabaseConfig{
			Host: "localhost", Port: 5432, Name: "blog", User: "blog",
			Password: "password", SSLMode: "disable", MaxOpenConns: 5,
			MaxIdleConns: 1, ConnMaxLifetime: time.Minute,
		},
		Redis:   RedisConfig{Host: "localhost", Port: 6379},
		Cookie:  CookieConfig{SessionName: "session", CSRFName: "csrf", SameSite: "lax"},
		Session: SessionConfig{IdleTTL: time.Hour},
	}
}
