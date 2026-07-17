package kit

import (
	"encoding/json"
	"fmt"
	"os"

	"golang.org/x/term"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

// isTerminal TTY 检测(可注入替身,测试用)。
var isTerminal = term.IsTerminal

// stdoutIsTTY 结果输出是否是终端(决定人类可读还是 JSON)。
func stdoutIsTTY() bool { return isTerminal(int(os.Stdout.Fd())) }

// stdinIsTTY 输入是否是终端(决定能否交互确认)。
func stdinIsTTY() bool { return isTerminal(int(os.Stdin.Fd())) }

// Render 按三态规则输出响应:--json 或管道 → protojson;TTY → 人类可读(表格/键值对)。
func (k *Kit) Render(msg proto.Message) error {
	if k.JSON || !stdoutIsTTY() {
		return printJSONTo(k.out(), msg)
	}
	fmt.Fprint(k.out(), RenderHuman(msg))
	return nil
}

// PrintJSON 用 protojson 输出 pretty JSON(无条件,raw 路径与过渡期用)。
func PrintJSON(msg proto.Message) error {
	return printJSONTo(os.Stdout, msg)
}

// printJSONTo 向指定 writer 输出 protojson。
func printJSONTo(w interface{ Write([]byte) (int, error) }, msg proto.Message) error {
	b, err := protojson.MarshalOptions{Multiline: true, EmitUnpopulated: true}.Marshal(msg)
	if err != nil {
		return fmt.Errorf("序列化响应失败: %w", err)
	}
	fmt.Fprintln(w, string(b))
	return nil
}

// PrintRaw 直接 pretty 打印原始 JSON(动态 path 接口未经 proto 映射时用)。
func PrintRaw(raw json.RawMessage) {
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		fmt.Println(string(raw))
		return
	}
	b, _ := json.MarshalIndent(v, "", "  ")
	fmt.Println(string(b))
}
