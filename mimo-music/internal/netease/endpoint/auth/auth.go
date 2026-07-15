// Package auth 定义登录认证接口的声明。
//
// auth 接口不走 Execute（需要 Set-Cookie 创建 session），只含 Meta + MapRequest。
// auth service 直接调 engine.RawDoWithCookie，拿到 raw + setCookie 后调 model 解码 + Save session。
package auth

import (
	"fmt"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// Meta 集合：各 auth 接口的执行元数据。

var (
	// SendCaptcha 发送验证码。
	SendCaptcha = engine.Meta{
		Path: "/weapi/sms/captcha/sent", Method: "POST", Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	}
	// LoginByCellphone 手机号登录。
	LoginCellphone = engine.Meta{
		Path: "/weapi/login/cellphone", Method: "POST", Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	}
	// LoginQrcode 获取二维码 key（非加密 POST）。
	LoginQrcode = engine.Meta{
		Path: "/api/login/qrcode/uniCreate", Method: "POST", Crypto: engine.CryptoNone, Auth: session.AuthAnonymous,
	}
	// CheckQrcode 轮询二维码状态（非加密 POST）。
	CheckQrcode = engine.Meta{
		Path: "/api/login/qrcode/client/login", Method: "POST", Crypto: engine.CryptoNone, Auth: session.AuthAnonymous,
	}
	// LoginStatus 查询登录态。
	LoginStatus = engine.Meta{
		Path: "/weapi/w/nuser/account/get", Method: "POST", Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	}
	// Logout 登出。
	Logout = engine.Meta{
		Path: "/weapi/logout", Method: "POST", Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	}
)

// MapRequest 集合：各 auth 接口的入参构造。

// SendCaptchaRequest 构造发送验证码入参。
func SendCaptchaRequest(req *mmpb.SendCaptchaRequest) map[string]any {
	return map[string]any{"cellphone": req.GetPhone(), "ctcode": "86"}
}

// LoginCellphoneRequest 构造手机登录入参。
func LoginCellphoneRequest(req *mmpb.LoginByCellphoneRequest) map[string]any {
	return map[string]any{
		"phone":         req.GetPhone(),
		"captcha":       req.GetCaptcha(),
		"countrycode":   "86",
		"rememberLogin": "true",
	}
}

// LoginQrcodeRequest 构造获取二维码 key 入参。
func LoginQrcodeRequest(_ *mmpb.LoginQrcodeRequest) map[string]any {
	return map[string]any{"type": 1}
}

// CheckQrcodeRequest 构造轮询二维码入参。
func CheckQrcodeRequest(req *mmpb.CheckQrcodeRequest) map[string]any {
	return map[string]any{"key": req.GetKey(), "type": 1}
}

// LoginStatusRequest 构造查询登录态入参。
func LoginStatusRequest(_ *mmpb.LoginStatusRequest) map[string]any {
	return map[string]any{}
}

// LogoutRequest 构造登出入参。
func LogoutRequest(_ *mmpb.LogoutRequest) map[string]any {
	return map[string]any{}
}

// QrcodeURL 从 key 构造二维码扫描 URL。
func QrcodeURL(key string) string {
	return fmt.Sprintf("https://music.163.com/login?codekey=%s", key)
}
