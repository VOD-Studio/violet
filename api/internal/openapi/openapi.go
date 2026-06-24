// Package openapi 为博客后端构建 OpenAPI 3.0 文档。
//
// 本包纯手写组装 spec 数据（不依赖注解/反射），按模块分文件注册 paths。
// 字段来源：handler request struct / service DTO / domain model 的静态反推。
package openapi

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/getkin/kin-openapi/openapi3"
)

var (
	cacheOnce  sync.Once
	cachedSpec *openapi3.T
	cachedJSON []byte
	cachedErr  error
)

// Spec 构建并缓存完整的 OpenAPI 3.0 文档（构建一次后复用）。
func Spec() (*openapi3.T, error) {
	cache()
	return cachedSpec, cachedErr
}

// JSON 返回序列化后的 OpenAPI JSON 字节（构建一次后复用）。
func JSON() ([]byte, error) {
	cache()
	return cachedJSON, cachedErr
}

// cache 一次性构建 spec 并序列化为 JSON，后续调用直接复用缓存。
// Spec() 与 JSON() 共用同一缓存，避免先调 Spec 后 JSON 返回空。
func cache() {
	cacheOnce.Do(func() {
		s, err := build()
		if err != nil {
			cachedErr = err
			return
		}
		cachedSpec = s
		cachedJSON, cachedErr = json.MarshalIndent(s, "", "  ")
	})
}

// Handler 返回提供 /openapi.json 的 HTTP handler。
func Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		b, err := JSON()
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(b)
	}
}

// build 组装顶层 spec：Info/Servers/SecuritySchemes，并调用各模块 path 注册。
// 各 paths_*.go 文件通过 registerXxxPaths(t) 形式的函数挂载到 t。
func build() (*openapi3.T, error) {
	t := &openapi3.T{
		OpenAPI: "3.0.3",
		Info: &openapi3.Info{
			Title:       "Mimo Blog API",
			Description: "全栈博客平台后端接口文档。鉴权采用 Cookie + CSRF Token（X-CSRF-Token 头），所有非 GET 写操作需携带有效的 CSRF Token。",
			Version:     "2.0.0",
		},
		Servers: openapi3.Servers{
			{URL: "/api/v1", Description: "API v1 前缀"},
		},
		Paths: &openapi3.Paths{},
		Components: &openapi3.Components{
			Schemas:         openapi3.Schemas{},
			SecuritySchemes: openapi3.SecuritySchemes{},
		},
	}

	// 注册公共 schema 与 security scheme（schemas.go / security.go）
	registerCommonSchemas(t)
	registerSecuritySchemes(t)

	// 各模块 path 注册（paths_*.go）。随各 Task 完成逐步放开。
	registerPublicPaths(t)
	registerAuthPaths(t)
	registerPostPaths(t)
	registerTagPaths(t)
	registerCommentPaths(t)
	registerMediaPaths(t)
	// registerMusicPaths(t)
	// registerAdminUserPaths(t)
	// registerAdminRBACPaths(t)
	// registerAdminStatsPaths(t)
	// registerAdminSettingsPaths(t)
	// registerAdminAnnouncementPaths(t)
	// registerAdminMusicPaths(t)
	// registerAdminEmojiPaths(t)
	// registerAdminFilePaths(t)

	return t, nil
}
