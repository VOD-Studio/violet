package migrate

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLatestMigrationVersion(t *testing.T) {
	for _, tc := range []struct {
		name    string
		files   []string
		want    int
		wantErr bool
	}{
		{"empty image", nil, 0, true},
		{"up files only", []string{"001_first.up.sql", "012_next.up.sql", "099_next.down.sql", "README.md"}, 12, false},
		{"numeric order", []string{"9_first.up.sql", "10_next.up.sql"}, 10, false},
		{"invalid version", []string{"99999999999999999999999999999_overflow.up.sql"}, 0, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			for _, name := range tc.files {
				if err := os.WriteFile(filepath.Join(dir, name), nil, 0600); err != nil {
					t.Fatal(err)
				}
			}
			got, err := getLatestVersionFromFiles(dir)
			if got != tc.want || (err != nil) != tc.wantErr {
				t.Fatalf("got (%d, %v), want (%d, error=%v)", got, err, tc.want, tc.wantErr)
			}
		})
	}
}
