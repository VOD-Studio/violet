package cli

import (
	"testing"
)

// --- expand 纯函数(执行路径,args[0] 命中别名)---

func TestExpand_HitReplacesArg0(t *testing.T) {
	for _, tc := range []struct {
		alias string
		want  []string
	}{
		{"pp", []string{"song", "play"}},
		{"dl", []string{"song", "download"}},
		{"pll", []string{"playlist", "download"}},
		{"se", []string{"search"}},
		{"rd", []string{"recommend", "daily-songs"}},
		{"whoami", []string{"login-status"}},
	} {
		t.Run(tc.alias, func(t *testing.T) {
			got, ok := expand([]string{tc.alias, "--id", "1"})
			if !ok {
				t.Fatalf("expand(%q) ok=false,want true", tc.alias)
			}
			want := append(append([]string{}, tc.want...), "--id", "1")
			if !sliceEq(got, want) {
				t.Errorf("expand(%q) = %v, want %v", tc.alias, got, want)
			}
		})
	}
}

func TestExpand_MissReturnsOriginal(t *testing.T) {
	args := []string{"song", "play", "--id", "1"}
	got, ok := expand(args)
	if ok {
		t.Error("未知命令应 miss,ok=true")
	}
	if !sliceEq(got, args) {
		t.Errorf("miss 应原样返回,got %v", got)
	}
}

func TestExpand_EmptyArgs(t *testing.T) {
	got, ok := expand(nil)
	if ok {
		t.Error("空 args 应 miss")
	}
	if got != nil && len(got) != 0 {
		t.Errorf("空 args 应返回空,got %v", got)
	}
}

func TestExpand_PreservesTrailingArgs(t *testing.T) {
	// pp --id 347230 --level 2 → song play --id 347230 --level 2
	got, ok := expand([]string{"pp", "--id", "347230", "--level", "2"})
	if !ok {
		t.Fatal("pp 应命中")
	}
	want := []string{"song", "play", "--id", "347230", "--level", "2"}
	if !sliceEq(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

// --- expandForCompletion(__complete/__completeNoDesc 路径,args[1] 命中别名)---

func TestExpandForCompletion_HitReplacesArg1(t *testing.T) {
	for _, proto := range []string{"__complete", "__completeNoDesc"} {
		t.Run(proto, func(t *testing.T) {
			got, ok := expandForCompletion([]string{proto, "pp", "--id", ""})
			if !ok {
				t.Fatalf("ok=false,want true")
			}
			want := []string{proto, "song", "play", "--id", ""}
			if !sliceEq(got, want) {
				t.Errorf("got %v, want %v", got, want)
			}
		})
	}
}

func TestExpandForCompletion_MissNonCompleteProto(t *testing.T) {
	// 非 __complete 协议命令(args[0]=play),不应触发补全路径重写。
	args := []string{"play", "pp"}
	got, ok := expandForCompletion(args)
	if ok {
		t.Error("非补全协议应 miss")
	}
	if !sliceEq(got, args) {
		t.Errorf("应原样返回,got %v", got)
	}
}

func TestExpandForCompletion_NonAliasArg1(t *testing.T) {
	// __complete song play ...(args[1]=song 不是别名)→ miss。
	args := []string{"__complete", "song", "play", "--id", ""}
	got, ok := expandForCompletion(args)
	if ok {
		t.Error("song 非别名应 miss")
	}
	if !sliceEq(got, args) {
		t.Errorf("应原样返回,got %v", got)
	}
}

func TestExpandForCompletion_TooShortArgs(t *testing.T) {
	// 只有 __complete,无后续 → 不重写。
	args := []string{"__complete"}
	got, ok := expandForCompletion(args)
	if ok {
		t.Error("args 过短应 miss")
	}
	if !sliceEq(got, args) {
		t.Errorf("应原样返回,got %v", got)
	}
}

// --- aliasList(--help 静态节用,顺序稳定)---

func TestAliasList_StableOrder(t *testing.T) {
	list := aliasList()
	// 顺序应为 pp/dl/pll/se/rd/whoami(字典序)。
	wantAliases := []string{"pp", "dl", "pll", "se", "rd", "whoami"}
	if len(list) != len(wantAliases) {
		t.Fatalf("got %d 别名,want %d", len(list), len(wantAliases))
	}
	for i, e := range list {
		if e.Alias != wantAliases[i] {
			t.Errorf("位置 %d: got %q, want %q", i, e.Alias, wantAliases[i])
		}
	}
}

func TestAliasList_ExpandsMatchTable(t *testing.T) {
	for _, e := range aliasList() {
		if !sliceEq(e.Expands, aliases[e.Alias]) {
			t.Errorf("aliasList 展开(%v)与表(%v)不符", e.Expands, aliases[e.Alias])
		}
	}
}

// --- sliceEq 测试辅助 ---
func sliceEq(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
