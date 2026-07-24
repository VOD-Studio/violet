// Package main 生成 musicctl 全命令 markdown 参考(cobra GenMarkdownTree)。
//
// 产物落 docs/cmd/(每命令一文件),入库即 web(GitHub)可搜索可链接。
// 与手写流程手册(musicctl-guide.md)组成文档双轨(clig.dev):
//   - 手册讲流程,命令细节指向 --help / 生成参考(不复制,避免第二份真相腐烂)
//   - 生成参考由命令树生成,freshness 守护测试保证永不脱节
//
// 用法:go run cmd/musicctl-docs/main.go [输出目录](默认 docs/cmd)
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra/doc"

	"github.com/VOD-Studio/mimo-music/internal/cli"
)

func main() {
	outDir := "docs/cmd"
	if len(os.Args) > 1 {
		outDir = os.Args[1]
	}
	abs, err := filepath.Abs(outDir)
	if err != nil {
		fmt.Fprintln(os.Stderr, "错误: 解析输出目录:", err)
		os.Exit(1)
	}
	if err := os.MkdirAll(abs, 0o755); err != nil {
		fmt.Fprintln(os.Stderr, "错误: 创建输出目录:", err)
		os.Exit(1)
	}
	root := cli.NewRootCommand()
	if err := doc.GenMarkdownTree(root, abs); err != nil {
		fmt.Fprintln(os.Stderr, "错误: 生成命令文档:", err)
		os.Exit(1)
	}
	fmt.Printf("已生成 musicctl 全命令参考到 %s\n", abs)
}
