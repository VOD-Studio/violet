package cli

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/spf13/cobra/doc"
)

// TestDocsFreshness 守护:重新生成命令 markdown 与入库的 docs/cmd/ diff,
// 不一致即红——命令树变了但文档没刷新。
//
// 改命令(新增/删除/改 Short/Long/Flag)后必须跑 `make docs`(cmd/musicctl-docs)
// 刷新 docs/cmd/,否则本测试失败。生成物非手写真相,天然不腐烂(clig.dev 双轨)。
//
// 跳过条件:docs/cmd/ 不存在(未生成,如全新 checkout 未跑 make docs)→ 跳过而非失败,
// 避免阻塞不关心文档的纯逻辑 CI;但 CI 应跑 make docs 入库后此测试生效。
func TestDocsFreshness(t *testing.T) {
	repoRoot := findRepoRoot(t)
	committedDir := filepath.Join(repoRoot, "docs", "cmd")
	if _, err := os.Stat(committedDir); os.IsNotExist(err) {
		t.Skip("docs/cmd/ 未生成(跑 make docs 入库后此守护生效)")
	}

	// 重新生成到临时目录。
	tmpDir := t.TempDir()
	root := NewRootCommand()
	if err := doc.GenMarkdownTree(root, tmpDir); err != nil {
		t.Fatalf("GenMarkdownTree 失败: %v", err)
	}

	// 对比临时目录与入库目录的文件集合 + 内容。
	tmpFiles := listFiles(t, tmpDir)
	committedFiles := listFiles(t, committedDir)

	// 文件集合差异。
	if len(tmpFiles) != len(committedFiles) {
		// 找出差异文件名,给出可操作提示。
		tmpSet := setOf(tmpFiles)
		commSet := setOf(committedFiles)
		var missing, extra []string
		for f := range commSet {
			if !tmpSet[f] {
				missing = append(missing, f)
			}
		}
		for f := range tmpSet {
			if !commSet[f] {
				extra = append(extra, f)
			}
		}
		t.Errorf("命令文档与命令树不一致(文件数入库=%d 生成=%d)。\n"+
			"入库有但生成无(命令已删?删文档): %v\n"+
			"生成有但入库无(新增命令?跑 make docs): %v\n"+
			"修复:在 mimo-music/ 下跑 make docs 并提交 docs/cmd/",
			len(committedFiles), len(tmpFiles), missing, extra)
		return
	}

	// 内容 diff。
	for _, f := range tmpFiles {
		tmpContent, err := os.ReadFile(filepath.Join(tmpDir, f))
		if err != nil {
			t.Fatalf("读生成文件 %s: %v", f, err)
		}
		commContent, err := os.ReadFile(filepath.Join(committedDir, f))
		if err != nil {
			t.Errorf("入库文件 %s 读失败(可能未提交): %v", f, err)
			continue
		}
		if normalizeMD(string(tmpContent)) != normalizeMD(string(commContent)) {
			t.Errorf("命令文档 %s 内容与命令树不一致(改了命令?跑 make docs 刷新)\n"+
				"生成内容前 200 字符:\n%s", f, truncate(string(tmpContent), 200))
		}
	}
}

// listFiles 列目录下所有 .md 文件名(相对路径)。
func listFiles(t *testing.T, dir string) []string {
	t.Helper()
	var files []string
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("读目录 %s: %v", dir, err)
	}
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".md") {
			files = append(files, e.Name())
		}
	}
	return files
}

func setOf(slice []string) map[string]bool {
	m := make(map[string]bool, len(slice))
	for _, s := range slice {
		m[s] = true
	}
	return m
}

// normalizeMD 规范化 markdown 内容用于 diff(去尾部空白/统一换行),减少虚假差异。
func normalizeMD(s string) string {
	// 去每行尾空白 + 统一 LF。
	lines := strings.Split(s, "\n")
	for i, l := range lines {
		lines[i] = strings.TrimRight(l, " \t\r")
	}
	return strings.Join(lines, "\n")
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

// findRepoRoot 找 mimo-music 模块根(含 go.mod 的目录),用于定位 docs/cmd/。
func findRepoRoot(t *testing.T) string {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 10; i++ {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	t.Fatal("找不到 go.mod(mimo-music 模块根)")
	return ""
}
