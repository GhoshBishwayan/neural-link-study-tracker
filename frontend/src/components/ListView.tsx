import React, { useState } from 'react';
import {
  Search, Filter, Plus, Star, RefreshCw, Folder,
  CheckCircle, Clock, ChevronRight, ChevronDown, Trash2, Edit3
} from 'lucide-react';
import { SyllabusNode, ExamSubject } from '../types';
import { api } from '../api/client';

interface ListViewProps {
  nodes: SyllabusNode[];
  examId: string;
  examName: string;
  examSubjects: ExamSubject[];
  onSelectNode: (node: SyllabusNode) => void;
  onOpenCreateModal: (parentNodeId?: string | null) => void;
  onRefresh: () => void;
}

export const ListView: React.FC<ListViewProps> = ({
  nodes,
  examId,
  examName,
  examSubjects,
  onSelectNode,
  onOpenCreateModal,
  onRefresh
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [needsRevisionOnly, setNeedsRevisionOnly] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  const toggleCollapse = (id: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStatusChange = async (node: SyllabusNode, newStatus: string) => {
    if (!node.topic_id) return;
    try {
      await api.updatePreparation(examId, node.topic_id, {
        status: newStatus as any
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNode = async (node: SyllabusNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Remove '${node.title}' from this examination syllabus?`)) {
      try {
        await api.deleteSyllabusNode(examId, node.id);
        onRefresh();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Build hierarchical tree
  const rootNodes = nodes.filter((n) => !n.parent_node_id);
  const childrenMap = new Map<string, SyllabusNode[]>();
  nodes.forEach((n) => {
    if (n.parent_node_id) {
      if (!childrenMap.has(n.parent_node_id)) {
        childrenMap.set(n.parent_node_id, []);
      }
      childrenMap.get(n.parent_node_id)!.push(n);
    }
  });

  const matchesFilter = (node: SyllabusNode): boolean => {
    if (search && !node.title.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    const status = node.preparation?.status || 'not_started';
    if (statusFilter !== 'all' && status !== statusFilter) {
      return false;
    }
    if (needsRevisionOnly) {
      const isOverdue =
        node.preparation?.next_revision_at &&
        new Date(node.preparation.next_revision_at).getTime() <= Date.now();
      if (!isOverdue) return false;
    }
    return true;
  };

  const renderNodeRow = (node: SyllabusNode, level: number = 0) => {
    const isVisible = matchesFilter(node);
    const children = childrenMap.get(node.id) || [];
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedNodes.has(node.id);
    const prep = node.preparation;
    const isOrg = node.is_organizational;

    return (
      <React.Fragment key={node.id}>
        {isVisible && (
          <div
            onClick={() => onSelectNode(node)}
            className="flex items-center justify-between p-3 bg-[#0e111a] border-b border-[#1e2538] hover:bg-[#131722] hover:border-[#00f0ff]/50 transition cursor-pointer group"
            style={{ paddingLeft: `${Math.max(12, level * 28 + 12)}px` }}
          >
            {/* Left: Expander + Title */}
            <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-4">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapse(node.id);
                  }}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              ) : (
                <div className="w-6" />
              )}

              {isOrg ? (
                <Folder className="w-4 h-4 text-purple-400 shrink-0" />
              ) : (
                <div
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    prep?.status === 'completed'
                      ? 'bg-[#00ff66]'
                      : prep?.status === 'reviewing'
                      ? 'bg-[#fcee0a]'
                      : prep?.status === 'learning'
                      ? 'bg-[#00f0ff]'
                      : 'bg-slate-600'
                  }`}
                />
              )}

              <span className="font-bold text-xs text-white truncate group-hover:text-[#00f0ff] transition">
                {node.title}
              </span>

              {isOrg && (
                <span className="text-[10px] px-1.5 py-0.2 bg-purple-950/60 border border-purple-500/50 text-purple-300 uppercase font-mono">
                  BRANCH
                </span>
              )}
            </div>

            {/* Right: Status, Confidence, Revisions, Actions */}
            <div className="flex items-center gap-4 shrink-0 text-xs font-mono" onClick={(e) => e.stopPropagation()}>
              {!isOrg && (
                <>
                  {/* Status Dropdown */}
                  <select
                    value={prep?.status || 'not_started'}
                    onChange={(e) => handleStatusChange(node, e.target.value)}
                    className="bg-[#131722] border border-[#1e2538] text-[11px] px-2 py-1 text-white uppercase focus:border-[#00f0ff]"
                  >
                    <option value="not_started">NOT STARTED</option>
                    <option value="learning">LEARNING</option>
                    <option value="reviewing">REVIEWING</option>
                    <option value="completed">COMPLETED</option>
                  </select>

                  {/* Confidence Stars */}
                  <div className="flex items-center gap-0.5 text-yellow-400">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span className="text-[11px] font-bold">{prep?.confidence_score || 1}/5</span>
                  </div>

                  {/* Revision Count */}
                  <div className="flex items-center gap-1 text-cyan-400 text-[11px]">
                    <RefreshCw className="w-3 h-3" />
                    <span>#{prep?.revision_count || 0}</span>
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition">
                <button
                  type="button"
                  onClick={() => onOpenCreateModal(node.id)}
                  title="Add child topic"
                  className="p-1 hover:text-[#00f0ff]"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteNode(node, e)}
                  title="Remove from syllabus"
                  className="p-1 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Render child nodes if not collapsed */}
        {!isCollapsed && children.map((c) => renderNodeRow(c, level + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      {/* HUD Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#0e111a] border border-[#1e2538] cyber-chamfer">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-6 bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
          <div>
            <div className="text-[10px] font-mono text-[#00f0ff] uppercase tracking-widest glow-cyan">
              EXAM SYLLABUS DIRECTORY // {examName}
            </div>
            <h1 className="text-base font-bold text-white uppercase tracking-wider">
              Hierarchical Syllabus Tree
            </h1>
          </div>
        </div>

        <button
          onClick={() => onOpenCreateModal(null)}
          className="px-4 py-2 bg-[#fcee0a] hover:bg-yellow-300 text-black font-bold font-mono text-xs uppercase flex items-center gap-2 glow-yellow self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> [ ADD ROOT SYLLABUS TOPIC ]
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-[#0e111a] border border-[#1e2538] text-xs font-mono">
        <div className="flex items-center flex-1 min-w-[200px] bg-[#131722] border border-[#1e2538] px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-slate-500 mr-2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search syllabus tree..."
            className="w-full bg-transparent border-none text-xs text-white focus:outline-none placeholder-slate-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 uppercase">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#131722] border border-[#1e2538] px-2.5 py-1.5 text-white uppercase focus:border-[#00f0ff]"
          >
            <option value="all">ALL STATUSES</option>
            <option value="not_started">NOT STARTED</option>
            <option value="learning">LEARNING</option>
            <option value="reviewing">REVIEWING</option>
            <option value="completed">COMPLETED</option>
          </select>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
          <input
            type="checkbox"
            checked={needsRevisionOnly}
            onChange={(e) => setNeedsRevisionOnly(e.target.checked)}
            className="accent-[#ff003c]"
          />
          <span className={needsRevisionOnly ? 'text-[#ff003c] font-bold' : ''}>
            Overdue Revisions Only
          </span>
        </label>
      </div>

      {/* Hierarchy Rows */}
      <div className="border border-[#1e2538] bg-[#07080c] divide-y divide-[#1e2538]">
        {rootNodes.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-slate-500">
            NO SYLLABUS NODES INITIALIZED FOR THIS EXAMINATION. CLICK "[ ADD ROOT SYLLABUS TOPIC ]" TO BEGIN.
          </div>
        ) : (
          rootNodes.map((n) => renderNodeRow(n, 0))
        )}
      </div>
    </div>
  );
};
