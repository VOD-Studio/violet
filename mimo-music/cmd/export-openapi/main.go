// Package main 导出 mimo-music 的 OpenAPI 3.0 spec 到 openapi.json。
package main

import (
	"fmt"
	"log"
	"os"

	"github.com/VOD-Studio/mimo-music/openapi"
)

func main() {
	data, err := openapi.JSON()
	if err != nil {
		log.Fatalf("生成 OpenAPI 失败: %v", err)
	}

	if err := os.WriteFile("openapi.json", data, 0644); err != nil {
		log.Fatalf("写入文件失败: %v", err)
	}

	fmt.Printf("OpenAPI spec 已导出到 openapi.json (%d bytes)\n", len(data))
}
