package chat

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"blog-api/internal/domain/shared"
)

var commandPathPartPattern = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9._:-]{0,79}$`)
var commandArgumentPattern = regexp.MustCompile(`^[a-z][a-z0-9-]{0,31}$`)
var commandIDPattern = regexp.MustCompile(`^[a-z][a-zA-Z0-9._:-]{0,127}$`)

// BotCommandArgument 是目录中供用户填写的参数提示。
type BotCommandArgument struct {
	// Name 参数名，不含尖括号。
	Name string `json:"name"`
	// Type 参数值类型，目前支持 string、integer、boolean。
	Type string `json:"type"`
	// Required 是否必填。
	Required bool `json:"required"`
}

// BotCommand 是 bot 声明可在 Violet 执行的命令。
type BotCommand struct {
	// ID 跨目录版本稳定的命令标识。
	ID string `json:"id"`
	// Path 不含斜杠前缀的命令路径。
	Path []string `json:"path"`
	// Description 给用户看的简短中文说明。
	Description string `json:"description"`
	// Arguments 参数提示，不作为待发送正文。
	Arguments []BotCommandArgument `json:"arguments"`
	// Scope conversation 表示本会话，global 表示跨会话操作。
	Scope string `json:"scope"`
}

// BotCommandCatalog 属于一个 bot 凭证，删除 bot 时须一并删除。
type BotCommandCatalog struct {
	// BotID 目录所属的凭证 ID，不能由发布请求指定。
	BotID shared.ID
	// SchemaVersion 请求协议版本，目前只能为 1。
	SchemaVersion int
	// Revision 规范化目录的 SHA-256 hex。
	Revision string
	// Commands 当前完整目录；空数组表示撤销。
	Commands []BotCommand
	// UpdatedAt 内容实际变化的时间，不能用作在线状态。
	UpdatedAt time.Time
}

// NewBotCommandCatalog 校验并规范化完整目录，顺序变化不产生新 revision。
func NewBotCommandCatalog(botID shared.ID, version int, commands []BotCommand, now time.Time) (BotCommandCatalog, error) {
	if version != 1 {
		return BotCommandCatalog{}, shared.BadRequest("不支持的命令目录版本")
	}
	if len(commands) > 100 {
		return BotCommandCatalog{}, shared.BadRequest("命令目录最多 100 项")
	}
	normalized := make([]BotCommand, 0, len(commands))
	ids, paths := map[string]bool{}, map[string]bool{}
	for _, command := range commands {
		command.ID = strings.TrimSpace(command.ID)
		command.Description = strings.TrimSpace(command.Description)
		if !commandIDPattern.MatchString(command.ID) || ids[command.ID] {
			return BotCommandCatalog{}, shared.BadRequest("命令 ID 非法或重复")
		}
		if len(command.Path) == 0 || len(command.Path) > 4 {
			return BotCommandCatalog{}, shared.BadRequest("命令路径长度非法")
		}
		command.Path = append([]string(nil), command.Path...)
		for i, part := range command.Path {
			command.Path[i] = strings.TrimSpace(part)
			if !commandPathPartPattern.MatchString(command.Path[i]) {
				return BotCommandCatalog{}, shared.BadRequest("命令路径字符非法")
			}
		}
		path := strings.ToLower(strings.Join(command.Path, " "))
		if paths[path] {
			return BotCommandCatalog{}, shared.BadRequest("命令路径重复")
		}
		if command.Description == "" || utf8.RuneCountInString(command.Description) > 120 {
			return BotCommandCatalog{}, shared.BadRequest("命令描述长度非法")
		}
		if command.Scope != "conversation" && command.Scope != "global" {
			return BotCommandCatalog{}, shared.BadRequest("命令作用域非法")
		}
		if len(command.Arguments) > 8 {
			return BotCommandCatalog{}, shared.BadRequest("命令参数最多 8 项")
		}
		argumentNames := map[string]bool{}
		for _, argument := range command.Arguments {
			if !commandArgumentPattern.MatchString(argument.Name) || argumentNames[argument.Name] ||
				(argument.Type != "string" && argument.Type != "integer" && argument.Type != "boolean") {
				return BotCommandCatalog{}, shared.BadRequest("命令参数格式非法")
			}
			argumentNames[argument.Name] = true
		}
		if command.Arguments == nil {
			command.Arguments = []BotCommandArgument{}
		}
		ids[command.ID], paths[path] = true, true
		normalized = append(normalized, command)
	}
	sort.Slice(normalized, func(i, j int) bool { return normalized[i].ID < normalized[j].ID })
	payload, _ := json.Marshal(struct {
		Version  int          `json:"schema_version"`
		Commands []BotCommand `json:"commands"`
	}{version, normalized})
	digest := sha256.Sum256(payload)
	return BotCommandCatalog{BotID: botID, SchemaVersion: version, Revision: hex.EncodeToString(digest[:]), Commands: normalized, UpdatedAt: now}, nil
}
