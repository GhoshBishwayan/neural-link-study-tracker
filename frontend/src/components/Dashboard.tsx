import React, { useState, useEffect } from 'react';
import {
  Activity, BookOpen, Layers, Award, Clock,
  RefreshCw, CheckCircle2, AlertTriangle, Info, Calendar, ArrowRight
} from 'lucide-react';
import { DashboardStats } from '../types';
import { api } from '../api/client';

interface DashboardProps {
  activeExamId?: string;
  onSelectTopic?: (topicId: string) => void;
  onQuickRevise?: (topicId: string, title: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  activeExamId,
  onSelectTopic,
  onQuickRevise
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [activeExamId]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await api.getDashboardStats(activeExamId);
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="p-12 text-center text-xs font-mono text-cyan-400">
        INITIALIZING NEURAL TELEMETRY STREAM...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* HUD Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#0e111a] border border-[#1e2538] cyber-chamfer">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-6 bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
          <div>
            <div className="text-[10px] font-mono text-[#00f0ff] uppercase tracking-widest glow-cyan">
              ACADEMIC TELEMETRY // SYSTEM OVERVIEW
            </div>
            <h1 className="text-base font-bold text-white uppercase tracking-wider">
              {stats.active_exam_name || 'Global Academic Command'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchStats}
            className="px-3 py-1.5 bg-[#131722] hover:bg-[#1a2030] border border-[#1e2538] text-xs font-mono text-cyan-400 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> REFRESH METRICS
          </button>
        </div>
      </div>

      {/* High-Level Counter Metrics (Section 8 Requirement) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Examinations */}
        <div className="p-4 bg-[#0e111a] border border-[#1e2538] hover:border-cyan-500/50 transition">
          <div className="text-[10px] font-mono uppercase text-slate-400">Total Examinations</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {stats.total_examinations}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Target certifications</div>
        </div>

        {/* Total Subjects */}
        <div className="p-4 bg-[#0e111a] border border-[#1e2538] hover:border-cyan-500/50 transition">
          <div className="text-[10px] font-mono uppercase text-slate-400">Reusable Subjects</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {stats.total_subjects}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Cross-exam disciplines</div>
        </div>

        {/* Total Canonical Topics (Deduplicated) */}
        <div className="p-4 bg-[#0e111a] border border-[#00f0ff]/50 shadow-[0_0_15px_rgba(0,240,255,0.08)]">
          <div className="text-[10px] font-mono uppercase text-[#00f0ff] glow-cyan">
            Canonical Knowledge Topics
          </div>
          <div className="text-2xl font-bold font-mono text-[#00f0ff] mt-1 glow-cyan">
            {stats.total_canonical_topics}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Unique concepts (no duplicates)</div>
        </div>

        {/* Total Exam Syllabus Entries */}
        <div className="p-4 bg-[#0e111a] border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.08)]">
          <div className="text-[10px] font-mono uppercase text-purple-400">
            Exam Syllabus Entries
          </div>
          <div className="text-2xl font-bold font-mono text-purple-300 mt-1">
            {stats.total_exam_syllabus_nodes}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Total tree placements</div>
        </div>
      </div>

      {/* Active Examination Mastery Progress */}
      {stats.active_exam_id && (
        <div className="p-5 bg-[#0e111a] border border-[#1e2538] cyber-chamfer space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-mono text-yellow-400 uppercase tracking-widest glow-yellow">
                ACTIVE EXAM COMPLETION INDEX
              </div>
              <h2 className="text-sm font-bold text-white uppercase">
                {stats.active_exam_name} Mastery Meter
              </h2>
            </div>
            <div className="text-2xl font-bold font-mono text-[#00ff66] glow-cyan">
              {stats.active_exam_progress_percent}%
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#131722] h-4 border border-[#1e2538] p-0.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00f0ff] via-[#fcee0a] to-[#00ff66] transition-all duration-700 shadow-[0_0_10px_#00ff66]"
              style={{ width: `${Math.min(100, Math.max(0, stats.active_exam_progress_percent))}%` }}
            />
          </div>

          {/* Breakdown chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="p-2 bg-[#131722] border border-[#1e2538]">
              <span className="text-slate-400 block text-[10px]">COMPLETED</span>
              <span className="text-[#00ff66] font-bold text-sm">
                {stats.active_exam_completed_topics} / {stats.active_exam_total_topics}
              </span>
            </div>
            <div className="p-2 bg-[#131722] border border-[#1e2538]">
              <span className="text-slate-400 block text-[10px]">REVIEWING</span>
              <span className="text-[#fcee0a] font-bold text-sm">{stats.active_exam_reviewing_topics}</span>
            </div>
            <div className="p-2 bg-[#131722] border border-[#1e2538]">
              <span className="text-slate-400 block text-[10px]">LEARNING</span>
              <span className="text-[#00f0ff] font-bold text-sm">{stats.active_exam_learning_topics}</span>
            </div>
            <div className="p-2 bg-[#131722] border border-[#1e2538]">
              <span className="text-slate-400 block text-[10px]">NOT STARTED</span>
              <span className="text-slate-400 font-bold text-sm">{stats.active_exam_not_started_topics}</span>
            </div>
          </div>

          {/* Explanation of Progress Formula (Section 8 Requirement) */}
          <div className="p-3 bg-black/40 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-start gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-cyan-300 font-bold">Calculation Formula:</span>{' '}
              {stats.progress_calculation_formula}
            </div>
          </div>
        </div>
      )}

      {/* Two-Column Grid: Subject Breakdown & Spaced Repetition Queue */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Subject Progress */}
        <div className="p-5 bg-[#0e111a] border border-[#1e2538] space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#1e2538]">
            <Layers className="w-4 h-4 text-[#00f0ff]" />
            <h3 className="text-xs font-bold font-mono uppercase text-white tracking-wider">
              Subject Mastery Breakdown ({stats.active_exam_name})
            </h3>
          </div>

          {stats.subject_progress.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-slate-500">
              NO SUBJECTS ASSOCIATED WITH ACTIVE EXAM
            </div>
          ) : (
            <div className="space-y-3">
              {stats.subject_progress.map((sp) => (
                <div key={sp.subject_id} className="space-y-1 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold">{sp.subject_name}</span>
                    <span className="text-cyan-400 font-bold">
                      {sp.completed_topics}/{sp.total_topics} ({sp.progress_percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#131722] h-2 border border-[#1e2538] overflow-hidden">
                    <div
                      className="h-full bg-[#00f0ff] shadow-[0_0_6px_#00f0ff]"
                      style={{ width: `${sp.progress_percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Spaced Repetition Due Queue */}
        <div className="p-5 bg-[#0e111a] border border-[#1e2538] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#1e2538]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#fcee0a]" />
              <h3 className="text-xs font-bold font-mono uppercase text-white tracking-wider">
                Spaced Repetition Due Queue
              </h3>
            </div>
            {stats.active_exam_needs_revision_topics > 0 && (
              <span className="px-2 py-0.5 bg-[#ff003c] text-white text-[10px] font-bold font-mono uppercase animate-pulse">
                {stats.active_exam_needs_revision_topics} OVERDUE
              </span>
            )}
          </div>

          {stats.upcoming_revisions.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-slate-500">
              NO TOPICS REQUIRING REVISION AT THIS TIME
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stats.upcoming_revisions.map((rev) => (
                <div
                  key={rev.topic_id}
                  className={`p-2.5 border text-xs font-mono flex items-center justify-between transition ${
                    rev.is_overdue
                      ? 'bg-red-950/20 border-red-500/50'
                      : 'bg-[#131722] border-[#1e2538]'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-white flex items-center gap-2">
                      <span>{rev.topic_title}</span>
                      {rev.is_overdue && (
                        <span className="text-[9px] px-1 bg-[#ff003c] text-white uppercase font-bold">
                          DUE NOW
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Conf: {rev.confidence_score}/5 | Rev #{rev.revision_count} | Due:{' '}
                      {new Date(rev.next_revision_at).toLocaleDateString()}
                    </div>
                  </div>

                  {onQuickRevise && (
                    <button
                      type="button"
                      onClick={() => onQuickRevise(rev.topic_id, rev.topic_title)}
                      className="px-2.5 py-1 bg-[#fcee0a] hover:bg-yellow-300 text-black font-bold text-[10px] uppercase font-mono"
                    >
                      Revise
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Cybernetic Activity Stream */}
      <div className="p-5 bg-[#0e111a] border border-[#1e2538] space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-[#1e2538]">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold font-mono uppercase text-white tracking-wider">
            Cybernetic Activity History Log
          </h3>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-xs">
          {stats.recent_activities.length === 0 ? (
            <div className="p-4 text-center text-slate-500">NO RECENT ACTIONS RECORDED</div>
          ) : (
            stats.recent_activities.map((act) => (
              <div
                key={act.id}
                className="p-2 bg-[#131722] border border-[#1e2538] flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.2 bg-black/60 border border-slate-700 text-cyan-300 uppercase">
                    {act.action_type.replace('_', ' ')}
                  </span>
                  <span className="text-slate-200">{act.details}</span>
                </div>
                <span className="text-[10px] text-slate-500 shrink-0">
                  {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
