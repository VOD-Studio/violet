package kit

import (
	"encoding/json"
	"fmt"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

// PrintJSON 用 protojson 输出 pretty JSON。
func PrintJSON(msg proto.Message) error {
	b, err := protojson.MarshalOptions{Multiline: true, EmitUnpopulated: true}.Marshal(msg)
	if err != nil {
		return fmt.Errorf("序列化响应失败: %w", err)
	}
	fmt.Println(string(b))
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
