// Package kit 的人类可读渲染层。
//
// RenderHuman 是输出层唯一 seam:proto.Message → 文本的纯函数。
// 含非空 repeated message 字段的响应渲染为分段表格,否则渲染为键值对。
package kit

import (
	"fmt"
	"strings"

	"github.com/mattn/go-runewidth"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
)

// maxCellLen 表格单元格最大宽度(按 rune 截断)。
const maxCellLen = 40

// RenderHuman 把 proto 响应渲染为人类可读文本(纯函数)。
//
// 含非空 repeated message 字段 → 每个字段一段表格(多段带 == 字段名 (数量) == 小标题);
// 否则按键值对逐行渲染,嵌套子结构退化为紧凑 JSON。
func RenderHuman(msg proto.Message) string {
	m := msg.ProtoReflect()
	var b strings.Builder
	sections := 0
	fields := m.Descriptor().Fields()
	for i := 0; i < fields.Len(); i++ {
		fd := fields.Get(i)
		if !fd.IsList() || fd.Kind() != protoreflect.MessageKind {
			continue
		}
		list := m.Get(fd).List()
		if list.Len() == 0 {
			continue
		}
		if sections > 0 {
			b.WriteByte('\n')
		}
		fmt.Fprintf(&b, "== %s (%d) ==\n", fd.JSONName(), list.Len())
		renderTable(&b, fd, list)
		sections++
	}
	if sections == 0 {
		renderKeyValues(&b, m)
	}
	return b.String()
}

// renderTable 把一个 repeated message 字段渲染成对齐表格。
// 列宽按显示宽度计算(runewidth):CJK 字符宽 2,中文歌名不错位。
func renderTable(b *strings.Builder, fd protoreflect.FieldDescriptor, list protoreflect.List) {
	cols := collectColumns(fd.Message())

	rows := make([][]string, 0, list.Len()+1)
	header := make([]string, len(cols))
	for i, c := range cols {
		header[i] = c.JSONName()
	}
	rows = append(rows, header)
	for i := 0; i < list.Len(); i++ {
		item := list.Get(i).Message()
		row := make([]string, len(cols))
		for j, c := range cols {
			row[j] = runewidth.Truncate(cellText(item, c), maxCellLen, "…")
		}
		rows = append(rows, row)
	}

	widths := make([]int, len(cols))
	for _, row := range rows {
		for j, cell := range row {
			if w := runewidth.StringWidth(cell); w > widths[j] {
				widths[j] = w
			}
		}
	}
	for _, row := range rows {
		for j, cell := range row {
			if j > 0 {
				b.WriteString("  ")
			}
			b.WriteString(runewidth.FillRight(cell, widths[j]))
		}
		b.WriteByte('\n')
	}
}

// collectColumns 收集条目类型的表格列:
// 标量字段直接成列;含 name 字段的 message(及其 repeated)塌缩为名字列;
// bytes 与 repeated 标量不成列(噪音大)。
func collectColumns(md protoreflect.MessageDescriptor) []protoreflect.FieldDescriptor {
	var cols []protoreflect.FieldDescriptor
	fields := md.Fields()
	for i := 0; i < fields.Len(); i++ {
		fd := fields.Get(i)
		switch {
		case fd.Kind() == protoreflect.BytesKind:
			continue
		case fd.IsList() && fd.Kind() != protoreflect.MessageKind:
			continue
		case fd.Kind() == protoreflect.MessageKind || fd.Kind() == protoreflect.GroupKind:
			if nameField(fd.Message()) == nil {
				continue
			}
		}
		cols = append(cols, fd)
	}
	return cols
}

// enumName 取枚举值的显示名。
func enumName(fd protoreflect.FieldDescriptor, v protoreflect.Value) string {
	return string(fd.Enum().Values().ByNumber(v.Enum()).Name())
}

// cellText 取一个单元格的文本。
func cellText(item protoreflect.Message, fd protoreflect.FieldDescriptor) string {
	v := item.Get(fd)
	switch {
	case fd.IsList():
		// repeated message: 各项取 name 字段 join
		var names []string
		list := v.List()
		for i := 0; i < list.Len(); i++ {
			if nf := nameField(fd.Message()); nf != nil {
				names = append(names, list.Get(i).Message().Get(nf).String())
			}
		}
		return strings.Join(names, "/")
	case fd.Kind() == protoreflect.MessageKind || fd.Kind() == protoreflect.GroupKind:
		if nf := nameField(fd.Message()); nf != nil {
			return v.Message().Get(nf).String()
		}
		return ""
	case fd.Kind() == protoreflect.EnumKind:
		return enumName(fd, v)
	default:
		return fmt.Sprintf("%v", v.Interface())
	}
}

// nameField 返回 message 的 name 字段描述符,无则 nil。
func nameField(md protoreflect.MessageDescriptor) protoreflect.FieldDescriptor {
	if md == nil {
		return nil
	}
	return md.Fields().ByName("name")
}

// renderKeyValues 按键值对逐行渲染标量字段;单层嵌套 message 缩进展开,
// 更深的子结构退化紧凑 JSON;标量列表 join。
func renderKeyValues(b *strings.Builder, m protoreflect.Message) {
	renderFields(b, m, "")
}

// renderFields 按缩进渲染一个 message 的字段(键值对模式递归一层用)。
func renderFields(b *strings.Builder, m protoreflect.Message, indent string) {
	fields := m.Descriptor().Fields()
	for i := 0; i < fields.Len(); i++ {
		fd := fields.Get(i)
		v := m.Get(fd)
		switch {
		case fd.IsList():
			if fd.Kind() == protoreflect.MessageKind {
				continue // 空 message 列表(非空时已走表格分支)
			}
			var items []string
			list := v.List()
			for j := 0; j < list.Len(); j++ {
				items = append(items, fmt.Sprintf("%v", list.Get(j).Interface()))
			}
			fmt.Fprintf(b, "%s%s: %s\n", indent, fd.JSONName(), strings.Join(items, ", "))
		case fd.Kind() == protoreflect.MessageKind || fd.Kind() == protoreflect.GroupKind:
			if indent != "" {
				// 只展开一层,更深的嵌套退化紧凑 JSON。
				j, _ := protojson.Marshal(v.Message().Interface())
				fmt.Fprintf(b, "%s%s: %s\n", indent, fd.JSONName(), j)
				continue
			}
			fmt.Fprintf(b, "%s:\n", fd.JSONName())
			renderFields(b, v.Message(), "  ")
		case fd.Kind() == protoreflect.EnumKind:
			fmt.Fprintf(b, "%s%s: %s\n", indent, fd.JSONName(), enumName(fd, v))
		default:
			fmt.Fprintf(b, "%s%s: %v\n", indent, fd.JSONName(), v.Interface())
		}
	}
}
