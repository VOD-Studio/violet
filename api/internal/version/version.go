// Package version 提供构建期注入的版本号。
//
// 本地开发与 CI 镜像验证构建不注入，保持默认值 dev；生产镜像构建时经
// ldflags 注入发版 tag（去掉前导 v，如 2.8.9）。openapi.Info.Version
// 等对外展示的版本一律取自本包，禁止在别处手写版本字符串。
package version

// Version 由构建命令经 -X blog-api/internal/version.Version 注入。
var Version = "dev"
