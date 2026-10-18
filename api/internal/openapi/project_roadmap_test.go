package openapi

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProjectListRoadmapSummaryContract(t *testing.T) {
	spec, err := Spec()
	require.NoError(t, err)
	schemas := openapi3.Schemas{}
	for _, name := range []string{"ProjectDTO", "ProjectRoadmapSummaryDTO", "ProjectRoadmapProgressDTO", "ProjectRoadmapItemPreviewDTO"} {
		schemas[name] = spec.Components.Schemas[name]
	}
	data, err := json.Marshal(&openapi3.T{OpenAPI: spec.OpenAPI, Info: spec.Info, Paths: &openapi3.Paths{},
		Components: &openapi3.Components{Schemas: schemas}})
	require.NoError(t, err)
	resolved, err := openapi3.NewLoader().LoadFromData(data)
	require.NoError(t, err)
	require.NoError(t, resolved.Validate(context.Background()))
	project := resolved.Components.Schemas["ProjectDTO"].Value
	require.Contains(t, project.Properties, "roadmap")
	assert.NotContains(t, project.Required, "roadmap", "项目详情不附带列表摘要")
	summary := resolved.Components.Schemas["ProjectRoadmapSummaryDTO"].Value
	var empty map[string]any
	require.NoError(t, json.Unmarshal([]byte(`{"progress":{"planned":0,"in_progress":0,"completed":0,"total":0,"percent":0},"in_progress":[],"latest_completed":null}`), &empty))
	require.NoError(t, summary.VisitJSON(empty))
	latest := map[string]any{"id": "item", "number": float64(1), "title": "Done", "completion_date": "2026-10-18"}
	empty["latest_completed"] = latest
	require.NoError(t, summary.VisitJSON(empty))
	preview := map[string]any{"id": "item", "number": float64(2), "title": "Developing", "completion_date": nil}
	empty["in_progress"] = []any{preview, preview}
	require.NoError(t, summary.VisitJSON(empty))
	empty["in_progress"] = []any{preview, preview, preview}
	assert.Error(t, summary.VisitJSON(empty), "契约限制最多两条开发中预览")

	list := spec.Paths.Find("/projects").Get
	assert.True(t, hasParam(list.Parameters, "page"))
	assert.True(t, hasParam(list.Parameters, "limit"))
}
