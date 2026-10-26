import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ZoomIn, ZoomOut, Maximize2, RotateCcw, Plus,
  Search, AlertCircle, RefreshCw, Star, Layers, Folder,
  CheckCircle2, Circle
} from 'lucide-react';
import { SyllabusNode, ExamSubject } from '../types';
import { api } from '../api/client';

interface SkillTreeProps {
  nodes: SyllabusNode[];
  examId: string;
  examName: string;
  examSubjects: ExamSubject[];
  onSelectNode: (node: SyllabusNode) => void;
  onOpenCreateModal: (parentNodeId?: string | null, x?: number, y?: number) => void;
  onRefresh: () => void;
}

export const SkillTree: React.FC<SkillTreeProps> = ({
  nodes,
  examId,
  examName,
  examSubjects,
  onSelectNode,
  onOpenCreateModal,
  onRefresh
}) => {
  // Canvas Viewport Pan & Zoom State
  const [pan, setPan] = useState({ x: 100, y: 80 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // Node Dragging State
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [localPositions, setLocalPositions] = useState<{ [id: string]: { x: number; y: number } }>({});

  // Filtering / Search
  const [filterQuery, setFilterQuery] = useState('');
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<any>(null);

  // Sync positions from nodes props
  useEffect(() => {
    const posMap: { [id: string]: { x: number; y: number } } = {};
    nodes.forEach((n) => {
      posMap[n.id] = { x: n.position_x, y: n.position_y };
    });
    setLocalPositions(posMap);
  }, [nodes]);

  // Handle Pan Mouse Events
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.skill-node') || (e.target as HTMLElement).closest('.control-panel')) {
      return;
    }
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
    } else if (draggingNodeId) {
      const newX = Math.round((e.clientX - pan.x) / zoom - dragOffset.x);
      const newY = Math.round((e.clientY - pan.y) / zoom - dragOffset.y);

      setLocalPositions((prev) => ({
        ...prev,
        [draggingNodeId]: { x: newX, y: newY }
      }));

      // Debounce save to backend
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await api.updateNodePositions(examId, [
            { id: draggingNodeId, position_x: newX, position_y: newY }
          ]);
        } catch (err) {
          console.error('Failed to save position:', err);
        }
      }, 500);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  // Zoom controls
  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(2.0, Math.max(0.4, prev + delta)));
  };

  const handleResetView = () => {
    setPan({ x: 80, y: 80 });
    setZoom(1);
  };

  const handleFitToScreen = () => {
    if (nodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach((n) => {
      const pos = localPositions[n.id] || { x: n.position_x, y: n.position_y };
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + 220);
      maxY = Math.max(maxY, pos.y + 100);
    });
    const width = maxX - minX || 600;
    const height = maxY - minY || 400;
    const containerW = containerRef.current?.clientWidth || 1000;
    const containerH = containerRef.current?.clientHeight || 600;
    const fitZoom = Math.min(1.2, Math.max(0.5, Math.min(containerW / (width + 100), containerH / (height + 100))));
    setZoom(fitZoom);
    setPan({
      x: (containerW - width * fitZoom) / 2 - minX * fitZoom,
      y: (containerH - height * fitZoom) / 2 - minY * fitZoom
    });
  };

  const toggleCollapse = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  // Node Drag Start
  const handleNodeDragStart = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const pos = localPositions[nodeId] || { x: 0, y: 0 };
    setDraggingNodeId(nodeId);
    setDragOffset({
      x: (e.clientX - pan.x) / zoom - pos.x,
      y: (e.clientY - pan.y) / zoom - pos.y
    });
  };

  // Map nodes by id
  const nodeMap = new Map<string, SyllabusNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  // Determine visibility based on collapse
  const isNodeVisible = (node: SyllabusNode): boolean => {
    let current = node;
    while (current.parent_node_id) {
      if (collapsedParentIds.has(current.parent_node_id)) {
        return false;
      }
      const parent = nodeMap.get(current.parent_node_id);
      if (!parent) break;
      current = parent;
    }
    return true;
  };

  const visibleNodes = nodes.filter((n) => {
    if (!isNodeVisible(n)) return false;
    if (filterQuery) {
      return n.title.toLowerCase().includes(filterQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={(e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        handleZoom(delta);
      }}
      className="relative w-full h-[calc(100vh-64px)] overflow-hidden bg-[#07080c] cursor-grab active:cursor-grabbing select-none cyber-scanlines"
    >
      {/* Background Cybernetic Circuit Grid */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="circuitGrid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#00f0ff" strokeWidth="0.5" />
            <circle cx="60" cy="0" r="1.5" fill="#00f0ff" />
            <circle cx="0" cy="60" r="1.5" fill="#00f0ff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#circuitGrid)" />
      </svg>

      {/* Floating HUD Controls */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 control-panel">
        <div className="flex items-center bg-[#0e111a]/90 backdrop-blur-md border border-[#1e2538] px-3 py-1.5 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
          <Search className="w-3.5 h-3.5 text-slate-500 mr-2" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search skill nodes..."
            className="bg-transparent border-none text-xs text-white focus:outline-none placeholder-slate-600 font-mono w-44"
          />
        </div>

        <button
          onClick={() => onOpenCreateModal(null, Math.round((-pan.x + 300) / zoom), Math.round((-pan.y + 200) / zoom))}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#fcee0a] hover:bg-yellow-300 text-black font-bold font-mono text-xs uppercase transition glow-yellow shadow-md"
        >
          <Plus className="w-3.5 h-3.5" /> [ ADD NODE ]
        </button>
      </div>

      {/* Viewport Zoom & Fit Controls */}
      <div className="absolute bottom-6 right-6 z-20 flex items-center gap-1.5 bg-[#0e111a]/90 backdrop-blur-md border border-[#1e2538] p-1.5 shadow-lg control-panel">
        <button
          onClick={() => handleZoom(0.15)}
          className="p-1.5 text-slate-300 hover:text-[#00f0ff] hover:bg-slate-800 transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(-0.15)}
          className="p-1.5 text-slate-300 hover:text-[#00f0ff] hover:bg-slate-800 transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleFitToScreen}
          className="p-1.5 text-slate-300 hover:text-[#00f0ff] hover:bg-slate-800 transition"
          title="Fit to Screen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetView}
          className="p-1.5 text-slate-300 hover:text-[#00f0ff] hover:bg-slate-800 transition"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="px-2 text-[10px] font-mono text-slate-500 border-l border-slate-800">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Pan & Zoom Canvas Container */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          position: 'absolute',
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      >
        {/* SVG Connector Circuit Lines */}
        <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible">
          <defs>
            <marker
              id="circuitArrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#00f0ff" />
            </marker>
            <marker
              id="prereqArrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#fcee0a" />
            </marker>
          </defs>

          {/* 1. Parent to Child Syllabus Hierarchy Lines */}
          {visibleNodes.map((node) => {
            if (!node.parent_node_id) return null;
            const parent = nodeMap.get(node.parent_node_id);
            if (!parent || !isNodeVisible(parent)) return null;

            const pPos = localPositions[parent.id] || { x: parent.position_x, y: parent.position_y };
            const cPos = localPositions[node.id] || { x: node.position_x, y: node.position_y };

            const startX = pPos.x + 200;
            const startY = pPos.y + 40;
            const endX = cPos.x;
            const endY = cPos.y + 40;

            const midX = (startX + endX) / 2;

            return (
              <path
                key={`line-parent-${node.id}`}
                d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                fill="none"
                stroke="#00f0ff"
                strokeWidth="2"
                strokeDasharray="4 2"
                opacity="0.6"
                markerEnd="url(#circuitArrow)"
              />
            );
          })}

          {/* 2. Prerequisite Dependency Lines */}
          {visibleNodes.map((node) => {
            if (!node.prerequisite_topic_ids || node.prerequisite_topic_ids.length === 0) return null;

            const cPos = localPositions[node.id] || { x: node.position_x, y: node.position_y };
            return node.prerequisite_topic_ids.map((prereqTopicId) => {
              // Find syllabus node in this tree representing the prerequisite topic
              const prereqNode = visibleNodes.find((vn) => vn.topic_id === prereqTopicId);
              if (!prereqNode) return null;

              const pPos = localPositions[prereqNode.id] || { x: prereqNode.position_x, y: prereqNode.position_y };

              const startX = pPos.x + 100;
              const startY = pPos.y + 80;
              const endX = cPos.x + 100;
              const endY = cPos.y;

              return (
                <path
                  key={`line-prereq-${prereqNode.id}-${node.id}`}
                  d={`M ${startX} ${startY} Q ${(startX + endX) / 2} ${(startY + endY) / 2 + 50}, ${endX} ${endY}`}
                  fill="none"
                  stroke="#fcee0a"
                  strokeWidth="2"
                  strokeDasharray="6 3"
                  opacity="0.8"
                  markerEnd="url(#prereqArrow)"
                />
              );
            });
          })}
        </svg>

        {/* Nodes Rendering */}
        <div className="absolute inset-0 pointer-events-auto">
          {visibleNodes.map((node) => {
            const pos = localPositions[node.id] || { x: node.position_x, y: node.position_y };
            const isOrg = node.is_organizational;
            const prep = node.preparation;
            const status = prep?.status || 'not_started';
            const isCompleted = status === 'completed';
            const isLearning = status === 'learning';
            const isReviewing = status === 'reviewing';

            // Check if overdue for revision
            const isOverdue =
              prep?.next_revision_at && new Date(prep.next_revision_at).getTime() <= Date.now();

            const childNodes = nodes.filter((n) => n.parent_node_id === node.id);
            const isCollapsed = collapsedParentIds.has(node.id);

            return (
              <div
                key={node.id}
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                  position: 'absolute'
                }}
                className="skill-node group"
                onClick={() => onSelectNode(node)}
              >
                {/* Node Container */}
                <div
                  onMouseDown={(e) => handleNodeDragStart(node.id, e)}
                  className={`w-52 p-3 bg-[#0e111a] border-2 transition shadow-lg cursor-grab active:cursor-grabbing ${
                    isOrg
                      ? 'border-purple-500/80 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                      : isCompleted
                      ? 'border-[#00ff66] border-glow-green'
                      : isReviewing
                      ? 'border-[#fcee0a] border-glow-yellow'
                      : isLearning
                      ? 'border-[#00f0ff] border-glow-cyan'
                      : 'border-[#1e2538] hover:border-slate-500'
                  }`}
                >
                  {/* Top Bar with Badges */}
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1.5 pb-1 border-b border-[#1e2538]">
                    <div className="flex items-center gap-1.5">
                      {isOrg ? (
                        <Folder className="w-3 h-3 text-purple-400" />
                      ) : (
                        <div
                          className={`w-2 h-2 rounded-full ${
                            isCompleted
                              ? 'bg-[#00ff66] shadow-[0_0_6px_#00ff66]'
                              : isReviewing
                              ? 'bg-[#fcee0a] shadow-[0_0_6px_#fcee0a]'
                              : isLearning
                              ? 'bg-[#00f0ff] shadow-[0_0_6px_#00f0ff]'
                              : 'bg-slate-600'
                          }`}
                        />
                      )}
                      <span className="uppercase text-slate-400 truncate max-w-[100px]">
                        {isOrg ? 'BRANCH' : status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Overdue Revision Beacon */}
                    {!isOrg && isOverdue && (
                      <span className="px-1 py-0.2 bg-[#ff003c] text-white text-[9px] font-bold uppercase animate-pulse">
                        REV DUE
                      </span>
                    )}

                    {/* Collapse Button if has children */}
                    {childNodes.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => toggleCollapse(node.id, e)}
                        className="p-0.5 text-slate-400 hover:text-white"
                        title={isCollapsed ? 'Expand Children' : 'Collapse Children'}
                      >
                        [{isCollapsed ? `+${childNodes.length}` : '-'}]
                      </button>
                    )}
                  </div>

                  {/* Title */}
                  <div className="font-bold text-xs text-white tracking-wide truncate mb-1">
                    {node.title}
                  </div>

                  {/* Metadata Row */}
                  {!isOrg && (
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <div className="flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 text-yellow-400 fill-current" />
                        <span>{prep?.confidence_score || 1}/5</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5 text-cyan-400" />
                        <span>Rev #{prep?.revision_count || 0}</span>
                      </div>
                    </div>
                  )}

                  {/* Quick Child Add Button on Hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenCreateModal(node.id, pos.x + 240, pos.y);
                    }}
                    className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#00f0ff] hover:bg-cyan-300 text-black font-bold text-xs rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-[0_0_10px_#00f0ff]"
                    title="Add Child Topic under this branch"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
