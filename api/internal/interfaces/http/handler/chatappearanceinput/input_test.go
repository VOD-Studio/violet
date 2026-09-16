package chatappearanceinput

import (
	"fmt"
	"strings"
	"testing"
)

const valid = `{"avatar_frame_id":"moon-cloud","avatar_charm_id":"a-star-bow","bubble_theme_id":"moon-letter","badge_ids":["rua"],"revision":0}`

func TestDecodeValidAndExplicitReset(t *testing.T) {
	for _, payload := range []string{
		valid,
		" \n" + valid + "\t",
		`{"avatar_frame_id":"","avatar_charm_id":"","bubble_theme_id":"","badge_ids":[],"revision":123}`,
		`{"avatar_frame_id":"","avatar_charm_id":"","bubble_theme_id":"","badge_ids":["rua","tea-party","night-owl"],"revision":1}`,
	} {
		if _, err := Decode(strings.NewReader(payload)); err != nil {
			t.Fatal(err)
		}
	}
}
func TestDecodeRejectsMalformedPartialAndInjectedInput(t *testing.T) {
	tests := map[string]string{
		"empty": "", "array": "[]", "null": "null", "string": `"oops"`, "number": "1", "missing": "{}",
		"partial": `{"bubble_theme_id":"moon-letter"}`, "duplicate": strings.Replace(valid, `"revision":0`, `"revision":0,"revision":1`, 1),
		"null field":      strings.Replace(valid, `"revision":0`, `"revision":null`, 1),
		"negative":        strings.Replace(valid, `"revision":0`, `"revision":-1`, 1),
		"unsafe integer":  strings.Replace(valid, `"revision":0`, `"revision":9007199254740991`, 1),
		"fraction":        strings.Replace(valid, `"revision":0`, `"revision":1.5`, 1),
		"string revision": strings.Replace(valid, `"revision":0`, `"revision":"0"`, 1),
		"foreign actor":   strings.TrimSuffix(valid, "}") + `,"user_id":"other"}`,
		"unknown theme":   strings.Replace(valid, "moon-letter", "https://bad.invalid/skin", 1),
		"trailing":        valid + "{}", "trailing scalar": valid + "true", "oversize": strings.Repeat(" ", 2049) + valid,
		"truncated": strings.TrimSuffix(valid, "}"), "bad type": strings.Replace(valid, `"a-star-bow"`, `42`, 1),
		"badge overflow":       strings.Replace(valid, `["rua"]`, `["rua","tea-party","night-owl","opal-heart"]`, 1),
		"badge duplicate":      strings.Replace(valid, `["rua"]`, `["rua","rua"]`, 1),
		"badge unknown":        strings.Replace(valid, `["rua"]`, `["no-such-badge"]`, 1),
		"badge not array":      strings.Replace(valid, `["rua"]`, `"rua"`, 1),
		"badge element Scalar": strings.Replace(valid, `["rua"]`, `["rua",42]`, 1),
		"badge null":           strings.Replace(valid, `["rua"]`, `null`, 1),
	}
	for name, payload := range tests {
		t.Run(name, func(t *testing.T) {
			if state, err := Decode(strings.NewReader(payload)); err == nil {
				t.Fatalf("accepted %#v", state)
			}
		})
	}
}
func TestParseUserIDs(t *testing.T) {
	id := "11111111-1111-4111-8111-11111111111a"
	ids, err := ParseUserIDs(strings.ToUpper(id) + "," + id)
	if err != nil || len(ids) != 2 || ids[0] != id {
		t.Fatal(ids, err)
	}
	for _, value := range []string{"", ",", id + ",", id + "'", strings.Repeat(id+",", 51), fmt.Sprintf("%s,%s", id, "../../me")} {
		if _, err := ParseUserIDs(value); err == nil {
			t.Fatalf("accepted %q", value)
		}
	}
}
