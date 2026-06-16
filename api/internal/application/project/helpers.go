package project

import "blog-api/internal/domain/shared"

func newID() shared.ID { return shared.NewID() }

func parseID(s string) (shared.ID, error) { return shared.ParseID(s) }
