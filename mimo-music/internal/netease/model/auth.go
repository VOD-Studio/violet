// Package model 的登录认证解码。
package model

import (
	"encoding/json"
	"fmt"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// rawLoginResponse 是网易云登录/登录态接口的响应。
type rawLoginResponse struct {
	Code    int `json:"code"`
	Account struct {
		ID int64 `json:"id"`
	} `json:"account"`
	Profile struct {
		UserID    int64  `json:"userId"`
		Nickname  string `json:"nickname"`
		AvatarURL string `json:"avatarUrl"`
	} `json:"profile"`
}

// DecodeLoginResponse 解析登录响应，提取用户信息（不含 cookie，cookie 由 service 层从 Set-Cookie 取）。
func DecodeLoginResponse(raw json.RawMessage) (*mmpb.Session, error) {
	var r rawLoginResponse
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, fmt.Errorf("解析登录响应失败: %w", err)
	}
	if r.Account.ID == 0 {
		return nil, fmt.Errorf("未登录")
	}
	return &mmpb.Session{
		UserId:    r.Account.ID,
		Nickname:  r.Profile.Nickname,
		AvatarUrl: r.Profile.AvatarURL,
	}, nil
}

// rawQrcodeKey 是二维码 key 获取响应。
type rawQrcodeKey struct {
	Code   int    `json:"code"`
	UniKey string `json:"unikey"`
}

// DecodeQrcodeKey 解析二维码 key 获取响应。
func DecodeQrcodeKey(raw json.RawMessage) (string, error) {
	var r rawQrcodeKey
	if err := json.Unmarshal(raw, &r); err != nil {
		return "", fmt.Errorf("解析二维码 key 失败: %w", err)
	}
	if r.UniKey == "" {
		return "", fmt.Errorf("获取二维码 key 失败")
	}
	return r.UniKey, nil
}

// rawQrcodeStatus 是二维码轮询响应。
type rawQrcodeStatus struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// DecodeQrcodeStatus 解析二维码轮询响应。
func DecodeQrcodeStatus(raw json.RawMessage) (mmpb.QrcodeCode, string, error) {
	var r rawQrcodeStatus
	if err := json.Unmarshal(raw, &r); err != nil {
		return 0, "", fmt.Errorf("解析二维码状态失败: %w", err)
	}
	return mmpb.QrcodeCode(r.Code), r.Message, nil
}
