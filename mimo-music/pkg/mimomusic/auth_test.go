package mimomusic

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"testing"
)

// TestSendCaptcha 验证发送验证码，POST + JSON body。
func TestSendCaptcha(t *testing.T) {
	c, cleanup := mockServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("应用 POST，得到 %s", r.Method)
		}
		if r.URL.Path != "/api/v1/auth/captcha" {
			t.Errorf("路径不符：%q", r.URL.Path)
		}
		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body["phone"] != "13800138000" {
			t.Errorf("phone body 不符：%q", body["phone"])
		}
		writeEnvelope(w, 200, 0, nil, "")
	})
	defer cleanup()

	if err := c.SendCaptcha(context.Background(), "13800138000"); err != nil {
		t.Fatalf("不应返回错误：%v", err)
	}
}

// TestLoginByCellphone 验证手机登录，返回 LoginResult。
func TestLoginByCellphone(t *testing.T) {
	c, cleanup := mockServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("应用 POST，得到 %s", r.Method)
		}
		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body["phone"] != "138" || body["captcha"] != "1234" {
			t.Errorf("body 不符：%+v", body)
		}
		writeEnvelope(w, 200, 0, LoginResult{
			UserID: "u1", Nickname: "测试", Avatar: "http://a.png",
		}, "")
	})
	defer cleanup()

	r, err := c.LoginByCellphone(context.Background(), "138", "1234")
	if err != nil {
		t.Fatalf("不应返回错误：%v", err)
	}
	if r.UserID != "u1" || r.Nickname != "测试" || r.Avatar != "http://a.png" {
		t.Fatalf("解析错误：%+v", r)
	}
}

// TestLoginByQrcode 验证获取二维码。
func TestLoginByQrcode(t *testing.T) {
	c, cleanup := mockServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/auth/login/qrcode" {
			t.Errorf("路径不符：%q", r.URL.Path)
		}
		writeEnvelope(w, 200, 0, QrcodeResult{Key: "k1", URL: "http://qr"}, "")
	})
	defer cleanup()

	r, err := c.LoginByQrcode(context.Background())
	if err != nil {
		t.Fatalf("不应返回错误：%v", err)
	}
	if r.Key != "k1" || r.URL != "http://qr" {
		t.Fatalf("解析错误：%+v", r)
	}
}

// TestCheckQrcode 验证二维码轮询，含 key query。
func TestCheckQrcode(t *testing.T) {
	cases := []struct {
		name    string
		resp    QrcodeCheckResult
		wantErr bool
	}{
		{"等待扫码", QrcodeCheckResult{Code: QrcodeStatusWaiting, Message: "等待"}, false},
		{"已扫码", QrcodeCheckResult{Code: QrcodeStatusScanned, Message: "扫描"}, false},
		{"确认登录", QrcodeCheckResult{Code: QrcodeStatusConfirmed, Message: "确认"}, false},
		{"已失效", QrcodeCheckResult{Code: QrcodeStatusExpired, Message: "失效"}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, cleanup := mockServer(t, func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Query().Get("key") != "k1" {
					t.Errorf("key 参数不符：%q", r.URL.Query().Get("key"))
				}
				writeEnvelope(w, 200, 0, tc.resp, "")
			})
			defer cleanup()

			r, err := c.CheckQrcode(context.Background(), "k1")
			if tc.wantErr {
				if err == nil {
					t.Fatal("应返回错误")
				}
				return
			}
			if err != nil {
				t.Fatalf("不应返回错误：%v", err)
			}
			if r.Code != tc.resp.Code {
				t.Fatalf("Code 不符：%d", r.Code)
			}
		})
	}
}

// TestLoginStatus 验证登录态查询，cookie 走 X-Cookie header。
func TestLoginStatus(t *testing.T) {
	t.Run("带 cookie 已登录", func(t *testing.T) {
		c, cleanup := mockServer(t, func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("X-Cookie") != "MUSIC_U=abc" {
				t.Errorf("X-Cookie header 不符：%q", r.Header.Get("X-Cookie"))
			}
			if r.Header.Get("Cookie") != "" {
				t.Errorf("不应设置标准 Cookie header，得到 %q", r.Header.Get("Cookie"))
			}
			writeEnvelope(w, 200, 0, LoginStatusResult{
				LoggedIn: true, UserID: "u1", Nickname: "测试",
			}, "")
		})
		defer cleanup()

		r, err := c.LoginStatus(context.Background(), "MUSIC_U=abc")
		if err != nil {
			t.Fatalf("不应返回错误：%v", err)
		}
		if !r.LoggedIn || r.UserID != "u1" {
			t.Fatalf("解析错误：%+v", r)
		}
	})

	t.Run("无 cookie 未登录", func(t *testing.T) {
		c, cleanup := mockServer(t, func(w http.ResponseWriter, r *http.Request) {
			writeEnvelope(w, 200, 0, LoginStatusResult{LoggedIn: false}, "")
		})
		defer cleanup()

		r, err := c.LoginStatus(context.Background(), "")
		if err != nil {
			t.Fatalf("不应返回错误：%v", err)
		}
		if r.LoggedIn {
			t.Fatal("空 cookie 应未登录")
		}
	})
}

// TestLogout 验证登出，POST + X-Cookie + user_id query。
func TestLogout(t *testing.T) {
	c, cleanup := mockServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("应用 POST，得到 %s", r.Method)
		}
		if r.Header.Get("X-Cookie") != "MUSIC_U=abc" {
			t.Errorf("X-Cookie 不符：%q", r.Header.Get("X-Cookie"))
		}
		if r.URL.Query().Get("user_id") != "u1" {
			t.Errorf("user_id 参数不符：%q", r.URL.Query().Get("user_id"))
		}
		// 确认 POST body 为空
		body, _ := io.ReadAll(r.Body)
		if len(body) != 0 {
			t.Errorf("logout body 应为空，得到 %q", body)
		}
		writeEnvelope(w, 200, 0, nil, "")
	})
	defer cleanup()

	if err := c.Logout(context.Background(), "u1", "MUSIC_U=abc"); err != nil {
		t.Fatalf("不应返回错误：%v", err)
	}
}

// TestGetDailyRecommend 验证每日推荐，无需调用方传 cookie。
func TestGetDailyRecommend(t *testing.T) {
	c, cleanup := mockServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/recommend/daily" {
			t.Errorf("路径不符：%q", r.URL.Path)
		}
		// mimo-music 服务端自管 cookie，请求不应带 cookie
		if r.Header.Get("Cookie") != "" || r.Header.Get("X-Cookie") != "" {
			t.Error("每日推荐不应带 cookie header")
		}
		writeEnvelope(w, 200, 0, RecommendResult{
			Songs: []Song{{ID: "s1", Name: "推荐曲"}},
		}, "")
	})
	defer cleanup()

	r, err := c.GetDailyRecommend(context.Background())
	if err != nil {
		t.Fatalf("不应返回错误：%v", err)
	}
	if len(r.Songs) != 1 || r.Songs[0].Name != "推荐曲" {
		t.Fatalf("解析错误：%+v", r)
	}
}

// TestGetPersonalFM 验证私人 FM，无需调用方传 cookie。
func TestGetPersonalFM(t *testing.T) {
	c, cleanup := mockServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/fm" {
			t.Errorf("路径不符：%q", r.URL.Path)
		}
		writeEnvelope(w, 200, 0, FMResult{
			Songs: []Song{{ID: "s2", Name: "FM 曲"}},
		}, "")
	})
	defer cleanup()

	r, err := c.GetPersonalFM(context.Background())
	if err != nil {
		t.Fatalf("不应返回错误：%v", err)
	}
	if len(r.Songs) != 1 || r.Songs[0].Name != "FM 曲" {
		t.Fatalf("解析错误：%+v", r)
	}
}

// TestAuth_Unauthorized 验证未授权错误码映射。
func TestAuth_Unauthorized(t *testing.T) {
	c, cleanup := mockServer(t, func(w http.ResponseWriter, r *http.Request) {
		writeEnvelope(w, 401, 10401, nil, "登录态失效")
	})
	defer cleanup()

	_, err := c.GetDailyRecommend(context.Background())
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("应返回 ErrUnauthorized，得到 %v", err)
	}
}
