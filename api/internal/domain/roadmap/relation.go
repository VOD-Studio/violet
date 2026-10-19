package roadmap

import (
	"time"

	"blog-api/internal/domain/shared"
)

// RelationType 的图约束各自独立，不能跨类型合并检测环。
type RelationType string

const (
	RelationExtends RelationType = "extends"
	RelationFixes   RelationType = "fixes"
	RelationBlocks  RelationType = "blocks"
)

// Relation 的方向按类型解释：A extends B 表示 A 扩展 B，A blocks B 表示 A 是 B 的前置。
type Relation struct {
	shared.AggregateRoot
	// id 关系 ID；显式删除后重新建立会产生新 ID。
	id shared.ID
	// projectID 两端条目共同所属的项目。
	projectID shared.ID
	// sourceID 来源条目，不能与目标相同。
	sourceID shared.ID
	// targetID 目标条目，必须与来源属于同一项目。
	targetID shared.ID
	// kind 关系类型；每种类型单独保持有向无环。
	kind RelationType
	// createdAt 关系建立时间。
	createdAt time.Time
}

// NewRelation 校验单边约束；项目归属与图约束须在持有项目锁的事务内另行校验。
func NewRelation(id, projectID, sourceID, targetID shared.ID, kind RelationType, now time.Time) (*Relation, error) {
	if id.IsZero() || projectID.IsZero() || sourceID.IsZero() || targetID.IsZero() {
		return nil, shared.BadRequest("条目关系 ID 不能为空")
	}
	if kind != RelationExtends && kind != RelationFixes && kind != RelationBlocks {
		return nil, shared.BadRequest("关系类型必须是 extends、fixes 或 blocks")
	}
	if sourceID.Equal(targetID) {
		return nil, shared.BadRequest("条目关系不能指向自身")
	}
	relation := ReconstructRelation(id, projectID, sourceID, targetID, kind, now)
	relation.RecordEvent(RelationCreated{
		BaseEvent: shared.NewBaseEvent("roadmap.relation.created", id),
		ProjectID: projectID, SourceID: sourceID, TargetID: targetID, Type: kind,
	})
	return relation, nil
}

// ReconstructRelation 从持久化记录还原，不产生创建事件。
func ReconstructRelation(id, projectID, sourceID, targetID shared.ID, kind RelationType, createdAt time.Time) *Relation {
	r := &Relation{
		id: id, projectID: projectID, sourceID: sourceID, targetID: targetID,
		kind: kind, createdAt: createdAt,
	}
	r.SetID(id)
	return r
}

// ValidateRelationGraph 检查同类型唯一性与环；existing 须包含软删除条目关联的隐藏关系。
func ValidateRelationGraph(candidate *Relation, existing []*Relation) error {
	adjacency := make(map[shared.ID][]shared.ID)
	for _, relation := range existing {
		if relation.Type() != candidate.Type() || !relation.ProjectID().Equal(candidate.ProjectID()) {
			continue
		}
		if relation.SourceID().Equal(candidate.SourceID()) && relation.TargetID().Equal(candidate.TargetID()) {
			return shared.Conflict("同类型的条目关系已存在")
		}
		adjacency[relation.SourceID()] = append(adjacency[relation.SourceID()], relation.TargetID())
	}
	visited := make(map[shared.ID]bool)
	queue := []shared.ID{candidate.TargetID()}
	for len(queue) > 0 {
		current := queue[len(queue)-1]
		queue = queue[:len(queue)-1]
		if current.Equal(candidate.SourceID()) {
			return shared.BadRequest("该关系会形成同类型的环")
		}
		if visited[current] {
			continue
		}
		visited[current] = true
		queue = append(queue, adjacency[current]...)
	}
	return nil
}

// MarkDeleted 仅供显式删除关系使用；条目软删除保留关系记录。
func (r *Relation) MarkDeleted() {
	r.RecordEvent(RelationDeleted{
		BaseEvent: shared.NewBaseEvent("roadmap.relation.deleted", r.ID()),
		ProjectID: r.ProjectID(), SourceID: r.SourceID(), TargetID: r.TargetID(), Type: r.Type(),
	})
}

func (r *Relation) ID() shared.ID        { return r.id }
func (r *Relation) ProjectID() shared.ID { return r.projectID }
func (r *Relation) SourceID() shared.ID  { return r.sourceID }
func (r *Relation) TargetID() shared.ID  { return r.targetID }
func (r *Relation) Type() RelationType   { return r.kind }
func (r *Relation) CreatedAt() time.Time { return r.createdAt }

type RelationCreated struct {
	shared.BaseEvent
	// ProjectID 关系两端共同所属的项目。
	ProjectID shared.ID
	// SourceID 来源条目。
	SourceID shared.ID
	// TargetID 目标条目。
	TargetID shared.ID
	// Type 关系类型。
	Type RelationType
}

type RelationDeleted struct {
	shared.BaseEvent
	// ProjectID 关系两端共同所属的项目。
	ProjectID shared.ID
	// SourceID 来源条目。
	SourceID shared.ID
	// TargetID 目标条目。
	TargetID shared.ID
	// Type 被显式删除的关系类型。
	Type RelationType
}
