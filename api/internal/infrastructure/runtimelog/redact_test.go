package runtimelog

import (
	"strings"
	"testing"
	"unicode/utf8"
)

func TestRedactCredentialsAndSQLLiterals(t *testing.T) {
	cases := []struct {
		name, message string
		secrets       []string
	}{
		{"headers", "Authorization: Bearer bearer-probe\nCookie: violet_session=session-probe; violet_csrf=csrf-probe", []string{"bearer-probe", "session-probe", "csrf-probe"}},
		{"structured text", `password="password-probe" api_key=key-probe code=654321`, []string{"password-probe", "key-probe", "654321"}},
		{"credential naming", "client_secret=client-probe access_token=access-probe refresh-token=refresh-probe API Key: spaced-probe OTP=442211 session_id=sid-probe", []string{"client-probe", "access-probe", "refresh-probe", "spaced-probe", "442211", "sid-probe"}},
		{"localized verification", "邮箱验证码：314159，验证码请勿分享", []string{"314159"}},
		{"connection", "connect postgres://ops:dsn-probe@database:5432/blog failed", []string{"dsn-probe"}},
		{"SQL escaping", `SELECT E'escape\\secret-probe', 'double''quote-probe', $tag$dollar-secret-probe$tag$, 987654 FROM users`, []string{"secret-probe", "quote-probe", "dollar-secret-probe", "987654"}},
		{"PostgreSQL standard string", `SELECT '\', 'sql-literal-probe', 1/0`, []string{"sql-literal-probe"}},
		{"PostgreSQL escape string", `SELECT E'it\'s escape-secret-probe', 'second-secret-probe', 1/0`, []string{"escape-secret-probe", "second-secret-probe"}},
		{"PostgreSQL numeric forms", `SELECT 654_321, 0b100101, 0b_100101, 0o273, 0o_1_755, 0xDEAD_BEEF, 0x_FF, 1_2.3_4e+5_6, .7_8`, []string{"654_321", "0b100101", "0b_100101", "0o273", "0o_1_755", "0xDEAD_BEEF", "0x_FF", "1_2.3_4e+5_6", ".7_8"}},
		{"incomplete literal", "SQL SELECT 'unfinished-secret-probe", []string{"unfinished-secret-probe"}},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			result := redact(test.message, 8192)
			for _, secret := range test.secrets {
				if strings.Contains(result, secret) {
					t.Fatalf("sensitive probe survived redaction for %s", test.name)
				}
			}
		})
	}
	if got := redact("HTTP 请求 · GET /api/v1/posts · 200", 8192); got != "HTTP 请求 · GET /api/v1/posts · 200" {
		t.Fatalf("non-sensitive request context changed: %s", got)
	}
	identifiers := redact("SELECT column2 FROM table1 WHERE shard_3 = 42", 8192)
	for _, identifier := range []string{"column2", "table1", "shard_3"} {
		if !strings.Contains(identifiers, identifier) {
			t.Fatalf("SQL identifier changed while redacting numbers: %s", identifiers)
		}
	}
	if strings.Contains(identifiers, "42") {
		t.Fatalf("SQL numeric literal survived redaction: %s", identifiers)
	}
}

func TestRedactPreservesUTF8AtOutputBoundary(t *testing.T) {
	result := redact(strings.Repeat("连接失败", 3000), 8192)
	if len(result) > 8192 || !utf8.ValidString(result) {
		t.Fatalf("invalid bounded UTF-8 message: bytes=%d", len(result))
	}
}
