package chatappearance

import (
	"errors"
	"strings"
	"testing"
)

func TestCatalogValidation(t *testing.T) {
	for name, values := range map[string]map[string]struct{}{"frames": frames, "charms": charms, "bubbles": bubbles} {
		for id := range values {
			if len(id) > 64 {
				t.Fatalf("%s: ID too long %s", name, id)
			}
			value := Selection{}
			switch name {
			case "frames":
				value.AvatarFrameID = id
			case "charms":
				value.AvatarCharmID = id
			case "bubbles":
				value.BubbleThemeID = id
			}
			if err := value.Validate(); err != nil {
				t.Fatal(err)
			}
		}
	}
	if err := (Selection{}).Validate(); err != nil {
		t.Fatal(err)
	}
	for _, bad := range []string{"https://evil.invalid/a.png", "../../secret", "url(javascript:alert(1))", "MOON-CLOUD", "moon-cloud ", strings.Repeat("a", 65), "unknown"} {
		t.Run(bad, func(t *testing.T) {
			for _, value := range []Selection{{AvatarFrameID: bad}, {AvatarCharmID: bad}, {BubbleThemeID: bad}} {
				if !errors.Is(value.Validate(), ErrInvalid) {
					t.Fatalf("accepted %#v", value)
				}
			}
		})
	}
}
func TestUserIDValidation(t *testing.T) {
	for _, id := range []string{"", "../me", "00000000-0000-0000-0000-000000000000", "11111111-1111-4111-8111-111111111111'"} {
		if ValidUserID(id) {
			t.Fatalf("accepted %s", id)
		}
	}
	if !ValidUserID("11111111-1111-4111-8111-111111111111") {
		t.Fatal("拒绝了合法 UUID")
	}
}
