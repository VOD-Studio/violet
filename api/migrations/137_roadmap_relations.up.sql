CREATE UNIQUE INDEX roadmap_items_project_id_id_idx ON roadmap_items (project_id, id);

CREATE TABLE roadmap_relations (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    source_id UUID NOT NULL,
    target_id UUID NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('extends', 'fixes', 'blocks')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT roadmap_relations_distinct_endpoints CHECK (source_id <> target_id),
    CONSTRAINT roadmap_relations_unique_edge UNIQUE (project_id, source_id, target_id, type),
    CONSTRAINT roadmap_relations_source_fk FOREIGN KEY (project_id, source_id)
        REFERENCES roadmap_items (project_id, id) ON DELETE CASCADE,
    CONSTRAINT roadmap_relations_target_fk FOREIGN KEY (project_id, target_id)
        REFERENCES roadmap_items (project_id, id) ON DELETE CASCADE
);

CREATE INDEX roadmap_relations_target_idx ON roadmap_relations (project_id, target_id);

COMMENT ON TABLE roadmap_relations IS '项目内按类型分别无环的条目关系；条目软删除不删除关系';
