package chat

import (
	"testing"
	"time"

	"blog-api/internal/domain/shared"
)

func TestNewBotCommandCatalogNormalizesRevision(t *testing.T) {
	botID := shared.NewID()
	commands := []BotCommand{
		{ID: "task.status", Path: []string{"task", "status"}, Description: " 查看任务状态 ", Arguments: []BotCommandArgument{{Name: "id", Type: "integer", Required: true}}, Scope: "conversation"},
		{ID: "ai", Path: []string{"ai"}, Description: "提问", Scope: "conversation"},
	}
	first, err := NewBotCommandCatalog(botID, 1, commands, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	second, err := NewBotCommandCatalog(botID, 1, []BotCommand{commands[1], commands[0]}, time.Now())
	if err != nil || first.Revision != second.Revision {
		t.Fatalf("顺序或无意义空格不应改变版本: %v, %s != %s", err, first.Revision, second.Revision)
	}
	if first.Commands[0].ID != "ai" || first.Commands[0].Arguments == nil || commands[0].Description != " 查看任务状态 " {
		t.Fatal("目录应排序且不修改调用方内容")
	}
	empty, err := NewBotCommandCatalog(botID, 1, nil, time.Now())
	if err != nil || empty.Commands == nil || empty.Revision == first.Revision {
		t.Fatal("空目录应能撤销并生成独立版本")
	}
}

func TestNewBotCommandCatalogAcceptsModelShortcut(t *testing.T) {
	_, err := NewBotCommandCatalog(shared.NewID(), 1, []BotCommand{{
		ID:          "ai.model.podlink-responses.gpt-5.6-sol",
		Path:        []string{"ai-podlink-responses.gpt-5.6-sol"},
		Description: "使用指定模型提问",
		Scope:       "conversation",
	}}, time.Now())
	if err != nil {
		t.Fatalf("Saber 的模型快捷命令应可发布: %v", err)
	}
}

func TestNewBotCommandCatalogRejectsInvalid(t *testing.T) {
	valid := BotCommand{ID: "task.list", Path: []string{"task", "list"}, Description: "查看任务", Scope: "conversation"}
	cases := []struct {
		name     string
		version  int
		commands []BotCommand
	}{
		{"version", 2, []BotCommand{valid}},
		{"id", 1, []BotCommand{{ID: "BAD", Path: []string{"bad"}, Description: "测试", Scope: "conversation"}}},
		{"duplicate id", 1, []BotCommand{valid, valid}},
		{"duplicate path", 1, []BotCommand{valid, {ID: "other", Path: valid.Path, Description: "测试", Scope: "conversation"}}},
		{"path", 1, []BotCommand{{ID: "bad", Path: []string{"/bad"}, Description: "测试", Scope: "conversation"}}},
		{"description", 1, []BotCommand{{ID: "bad", Path: []string{"bad"}, Scope: "conversation"}}},
		{"scope", 1, []BotCommand{{ID: "bad", Path: []string{"bad"}, Description: "测试", Scope: "site"}}},
		{"argument", 1, []BotCommand{{ID: "bad", Path: []string{"bad"}, Description: "测试", Scope: "conversation", Arguments: []BotCommandArgument{{Name: "id", Type: "object"}}}}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := NewBotCommandCatalog(shared.NewID(), tc.version, tc.commands, time.Now()); err == nil {
				t.Fatal("应拒绝非法目录")
			}
		})
	}
}
