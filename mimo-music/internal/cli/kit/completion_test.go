package kit

import (
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/spf13/cobra"

	"github.com/VOD-Studio/mimo-music/internal/cli/recall"
)

// newRootWithCompletion 构造一个挂了补全的 root(含一个带 --id/--level/--area 的子命令),
// 召回池指向临时目录并预填事件。
func newRootWithCompletion(t *testing.T, events []recall.Event) (*cobra.Command, *Kit) {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "history.jsonl")
	now := time.Date(2026, 7, 24, 20, 0, 0, 0, time.UTC)
	pool := recall.NewPool(func() (string, error) { return path, nil }).WithClock(func() time.Time { return now })
	if len(events) > 0 {
		if err := pool.Append(events...); err != nil {
			t.Fatal(err)
		}
	}
	k := &Kit{}
	k.SetRecallPool(pool)

	root := &cobra.Command{Use: "musicctl"}
	// 子命令带 --id / --level / --area。
	sub := &cobra.Command{Use: "play", RunE: func(*cobra.Command, []string) error { return nil }}
	var id int64
	var level int
	var area string
	sub.Flags().Int64Var(&id, "id", 0, "歌曲 ID")
	sub.Flags().IntVar(&level, "level", 1, "音质")
	sub.Flags().StringVar(&area, "area", "ALL", "地区")
	root.AddCommand(sub)
	// 一个不带这些 flag 的命令(验证不误挂)。
	other := &cobra.Command{Use: "status", RunE: func(*cobra.Command, []string) error { return nil }}
	root.AddCommand(other)

	MountCompletion(root, k)
	return root, k
}

func TestMountCompletion_RegistersIDFlagOnAllRelevantCommands(t *testing.T) {
	root, _ := newRootWithCompletion(t, nil)
	play, _, _ := root.Find([]string{"play"})
	if play == nil {
		t.Fatal("找不到 play 子命令")
	}
	if _, ok := play.GetFlagCompletionFunc("id"); !ok {
		t.Error("play --id 应注册补全")
	}
	if _, ok := play.GetFlagCompletionFunc("level"); !ok {
		t.Error("play --level 应注册补全")
	}
	if _, ok := play.GetFlagCompletionFunc("area"); !ok {
		t.Error("play --area 应注册补全")
	}
}

func TestMountCompletion_DoesNotRegisterOnCommandWithoutFlag(t *testing.T) {
	root, _ := newRootWithCompletion(t, nil)
	status, _, _ := root.Find([]string{"status"})
	if _, ok := status.GetFlagCompletionFunc("id"); ok {
		t.Error("status 无 --id flag,不应注册补全")
	}
}

func TestCompleteID_ReturnsRecallCandidates(t *testing.T) {
	events := []recall.Event{
		{ID: 347230, Name: "晴天", Artist: "周杰伦", Src: recall.SrcPlay, TS: time.Now().Add(-1 * time.Minute)},
		{ID: 347231, Name: "稻香", Artist: "周杰伦", Src: recall.SrcPlay, TS: time.Now().Add(-2 * time.Minute)},
	}
	root, _ := newRootWithCompletion(t, events)
	play, _, _ := root.Find([]string{"play"})
	fn, ok := play.GetFlagCompletionFunc("id")
	if !ok {
		t.Fatal("未注册 id 补全")
	}
	comps, _ := fn(play, nil, "")
	if len(comps) != 2 {
		t.Fatalf("应 2 候选,got %d: %v", len(comps), comps)
	}
	// 应带描述列「歌名 - 艺人」。
	if !strings.Contains(comps[0], "晴天") || !strings.Contains(comps[0], "周杰伦") {
		t.Errorf("候选应含歌名艺人,got %s", comps[0])
	}
}

func TestCompleteID_PrefixFilters(t *testing.T) {
	events := []recall.Event{
		{ID: 347230, Name: "晴天", Src: recall.SrcPlay},
		{ID: 100, Name: "other", Src: recall.SrcPlay},
	}
	root, _ := newRootWithCompletion(t, events)
	play, _, _ := root.Find([]string{"play"})
	fn, _ := play.GetFlagCompletionFunc("id")
	comps, _ := fn(play, nil, "347")
	if len(comps) != 1 {
		t.Errorf("toComplete=347 应只匹配 347230,got %d: %v", len(comps), comps)
	}
}

func TestCompleteID_NilPoolReturnsEmpty(t *testing.T) {
	k := &Kit{} // 无 pool
	root := &cobra.Command{Use: "musicctl"}
	sub := &cobra.Command{Use: "play"}
	var id int64
	sub.Flags().Int64Var(&id, "id", 0, "")
	root.AddCommand(sub)
	MountCompletion(root, k)
	fn, ok := sub.GetFlagCompletionFunc("id")
	if !ok {
		t.Fatal("应注册(即便 pool nil)")
	}
	comps, _ := fn(sub, nil, "")
	if len(comps) != 0 {
		t.Errorf("nil pool 应返回空候选,got %v", comps)
	}
}

func TestCompleteEnum_ReturnsAllValues(t *testing.T) {
	root, _ := newRootWithCompletion(t, nil)
	play, _, _ := root.Find([]string{"play"})
	fn, ok := play.GetFlagCompletionFunc("level")
	if !ok {
		t.Fatal("未注册 level 补全")
	}
	comps, _ := fn(play, nil, "")
	if len(comps) != 4 {
		t.Errorf("level 应 4 枚举(1/2/3/4),got %v", comps)
	}
}

func TestCompleteEnum_PrefixFilters(t *testing.T) {
	root, _ := newRootWithCompletion(t, nil)
	play, _, _ := root.Find([]string{"play"})
	fn, _ := play.GetFlagCompletionFunc("area")
	comps, _ := fn(play, nil, "Z")
	if len(comps) != 1 || comps[0] != "ZH" {
		t.Errorf("area toComplete=Z 应只匹配 ZH,got %v", comps)
	}
}

func TestMountCompletion_RespectsExistingRegistration(t *testing.T) {
	// 命令就地覆盖注册后,MountCompletion 应跳过该 flag。
	dir := t.TempDir()
	pool := recall.NewPool(func() (string, error) { return filepath.Join(dir, "h.jsonl"), nil })
	k := &Kit{}
	k.SetRecallPool(pool)
	root := &cobra.Command{Use: "musicctl"}
	sub := &cobra.Command{Use: "play"}
	var id int64
	sub.Flags().Int64Var(&id, "id", 0, "")
	custom := func(*cobra.Command, []string, string) ([]string, cobra.ShellCompDirective) {
		return []string{"CUSTOM"}, cobra.ShellCompDirectiveNoFileComp
	}
	_ = sub.RegisterFlagCompletionFunc("id", custom)
	root.AddCommand(sub)
	MountCompletion(root, k)
	fn, _ := sub.GetFlagCompletionFunc("id")
	comps, _ := fn(sub, nil, "")
	if len(comps) != 1 || comps[0] != "CUSTOM" {
		t.Errorf("就地覆盖应保留,got %v", comps)
	}
}
