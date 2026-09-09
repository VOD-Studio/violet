// 本地调试工具：把 openapi spec 序列化到 openapi.json，便于 jq 检查或导入外部工具。
// 线上文档由 GET /api/v1/openapi.json 实时提供，防漂移由路由对账测试把关
// （internal/interfaces/http/routing/parity_test.go）。
// 用法：go run ./cmd/export-openapi
package main

import (
	"os"

	"blog-api/internal/openapi"
)

func main() {
	b, err := openapi.JSON()
	if err != nil {
		panic(err)
	}
	if err := os.WriteFile("openapi.json", b, 0644); err != nil {
		panic(err)
	}
	os.Stdout.Write([]byte("openapi.json written: "))
	println(len(b), "bytes")
}
