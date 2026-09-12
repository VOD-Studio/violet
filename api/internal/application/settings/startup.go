package settings

import "time"

// StartupField is a read-only display carrier, never accepted by a write endpoint.
type StartupField struct {
	Key       string `json:"key"`
	Label     string `json:"label"`
	Value     any    `json:"value"`  // string | number | boolean | null; sensitive fields are boolean only.
	Source    string `json:"source"` // environment | default | runtime
	Sensitive bool   `json:"sensitive"`
}

type StartupSection struct {
	ID     string         `json:"id"`
	Label  string         `json:"label"`
	Fields []StartupField `json:"fields"`
}

type StartupSnapshot struct {
	ObservedAt time.Time        `json:"observed_at"`
	Sections   []StartupSection `json:"sections"`
}

type StartupReader interface{ Snapshot() StartupSnapshot }
