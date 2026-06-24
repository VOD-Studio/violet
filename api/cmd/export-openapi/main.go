// 临时导出工具：把 openapi spec 序列化到 openapi.json，供 Apifox 导入。
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
