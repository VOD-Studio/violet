/**
 * TaskItemView - 用项目 Checkbox 组件替换 Tiptap TaskItem 默认的原生 <input type="checkbox">。
 *
 * 仅影响编辑器内渲染（NodeView），不影响 editor.getHTML() 输出（仍由 TaskItem.renderHTML 决定）。
 * 详情页通过 markdown-components 的 input 组件映射处理，两处独立。
 */

import TaskItem from "@tiptap/extension-task-item";
import {
    NodeViewContent,
    type NodeViewProps,
    NodeViewWrapper,
    ReactNodeViewRenderer,
} from "@tiptap/react";
import { Checkbox } from "@/shared/ui/base/checkbox";

function TaskItemComponent({ node, updateAttributes, editor }: NodeViewProps) {
    const checked = node.attrs.checked as boolean;

    return (
        <NodeViewWrapper as="li" className="flex items-start gap-2" data-checked={checked}>
            <Checkbox
                checked={checked}
                disabled={!editor.isEditable}
                onCheckedChange={(val) => updateAttributes({ checked: val === true })}
                className="mt-1.5 shrink-0"
            />
            <NodeViewContent as="div" className="flex-1 min-w-0" />
        </NodeViewWrapper>
    );
}

/** 自定义 TaskItem：继承原扩展，仅覆盖 NodeView */
export const CustomTaskItem = TaskItem.extend({
    addNodeView() {
        return ReactNodeViewRenderer(TaskItemComponent);
    },
}).configure({ nested: true });
