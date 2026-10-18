package roadmap

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/shared"
)

func TestRelationValidation(t *testing.T) {
	projectID, a, b := shared.NewID(), shared.NewID(), shared.NewID()
	for _, test := range []struct {
		name   string
		target shared.ID
		kind   RelationType
	}{
		{name: "self", target: a, kind: RelationBlocks},
		{name: "unknown type", target: b, kind: "related"},
		{name: "empty target", target: shared.ID{}, kind: RelationBlocks},
	} {
		t.Run(test.name, func(t *testing.T) {
			_, err := NewRelation(shared.NewID(), projectID, a, test.target, test.kind, time.Now())
			require.Error(t, err)
		})
	}
	relation, err := NewRelation(shared.NewID(), projectID, a, b, RelationBlocks, time.Now())
	require.NoError(t, err)
	events := relation.PullEvents()
	require.Len(t, events, 1)
	assert.Equal(t, "roadmap.relation.created", events[0].EventName())
}

func TestRelationGraphSeparatesTypesAndProjects(t *testing.T) {
	projectID, otherProject := shared.NewID(), shared.NewID()
	a, b, c := shared.NewID(), shared.NewID(), shared.NewID()
	makeRelation := func(project, source, target shared.ID, kind RelationType) *Relation {
		return ReconstructRelation(shared.NewID(), project, source, target, kind, time.Now())
	}
	existing := []*Relation{
		makeRelation(projectID, a, b, RelationBlocks),
		makeRelation(projectID, b, c, RelationBlocks),
		makeRelation(otherProject, a, c, RelationFixes),
	}
	tests := []struct {
		name      string
		source    shared.ID
		target    shared.ID
		kind      RelationType
		wantError bool
	}{
		{name: "duplicate", source: a, target: b, kind: RelationBlocks, wantError: true},
		{name: "reverse cycle", source: b, target: a, kind: RelationBlocks, wantError: true},
		{name: "multi hop cycle", source: c, target: a, kind: RelationBlocks, wantError: true},
		{name: "different type reverse", source: b, target: a, kind: RelationExtends},
		{name: "different type same pair", source: a, target: b, kind: RelationFixes},
		{name: "different project", source: c, target: a, kind: RelationFixes},
		{name: "new branch", source: a, target: c, kind: RelationBlocks},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateRelationGraph(makeRelation(projectID, test.source, test.target, test.kind), existing)
			if test.wantError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
