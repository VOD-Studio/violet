// Package openapi 为 mimo-music 构建手写的 OpenAPI 3.0 文档。
//
// 纯手写组装 spec（不依赖注解 / 反射），对齐 mimo-blog 的 openapi 模式。
// 按模块分文件注册 paths，统一在此聚合。
package openapi

import (
	"encoding/json"

	"github.com/getkin/kin-openapi/openapi3"
)

// Spec 构建完整的 OpenAPI 3.0 文档。
func Spec() (*openapi3.T, error) {
	t := &openapi3.T{
		OpenAPI: "3.0.3",
		Info: &openapi3.Info{
			Title:       "mimo-music API",
			Description: "多平台音乐能力服务",
			Version:     "0.1.0",
		},
		Servers: openapi3.Servers{
			{URL: "http://localhost:8080", Description: "本地开发"},
		},
		Paths: &openapi3.Paths{},
	}

	// 注册各模块 paths
	registerAuthPaths(t.Paths)
	registerPlaylistPaths(t.Paths)
	registerSongPaths(t.Paths)
	registerSearchPaths(t.Paths)

	return t, nil
}

// JSON 返回序列化后的 OpenAPI JSON。
func JSON() ([]byte, error) {
	t, err := Spec()
	if err != nil {
		return nil, err
	}
	return json.MarshalIndent(t, "", "  ")
}
