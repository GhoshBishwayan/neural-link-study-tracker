import React, { useState, useEffect } from 'react';
import {
  X, BookOpen, RefreshCw, Star, Clock, Layers,
  ExternalLink, Trash2, Save, AlertTriangle, CheckCircle, Plus
} from 'lucide-react';
import { api } from '../api/client';
import { SyllabusNode, TopicUsageResponse, KnowledgeTopic, TopicPreparation, RevisionHistory } from '../types';
import { RevisionModal } from './RevisionModal';

interface TopicInspectorProps {
  node: SyllabusNode | null;
  activeExamId: string;
  activeExamName: string;
  onClose: () => void;
  onRefresh: () => void;
  onSwitchExam?: (examId: string) => void;
}

export const TopicInspector: React.FC<TopicInspectorProps> = ({
  node,
  activeExamId,
  activeExamName,
  onClose,
  onRefresh,
  onSwitchExam
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'prep' | 'usage' | 'prereqs'>('notes');
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);

  // Notes state
  const [globalNotes, setGlobalNotes] = useState('');
  const [personalNotes, setPersonalNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Preparation state
  const [status, setStatus] = useState<string>('not_started');
  const [confidence, setConfidence] = useState<number>(1);
  const [studyMinutes, setStudyMinutes] = useState<number>(0);

  // Cross-Exam usage state
  const [usageData, setUsageData] = useState<TopicUsageResponse | null>(null);

  // Prerequisites state
  const [prereqs, setPrereqs] = useState<Array<{ id: string; prerequisite_topic_id: string; prerequisite_title?: string }>>([]);
  const [allTopics, setAllTopics] = useState<KnowledgeTopic[]>([]);
  const [selectedPrereqId, setSelectedPrereqId] = useState<string>('');

  // Deletion modal / safety state
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  useEffect(() => {
    if (node && node.topic) {
      setGlobalNotes(node.topic.general_notes || '');
      setPersonalNotes(node.preparation?.personal_notes || '');
      setStatus(node.preparation?.status || 'not_started');
      setConfidence(node.preparation?.confidence_score || 1);
      setStudyMinutes(node.preparation?.actual_study_minutes || 0);
      setDeleteWarning(null);
      setDeleteConfirmed(false);

      // Fetch usage & prerequisites
      if (node.topic.id) {
        api.getTopicUsage(node.topic.id).then(setUsageData).catch(console.error);
        api.getPrerequisites(node.topic.id).then(setPrereqs).catch(console.error);
        api.getTopics().then((res) => {
          setAllTopics(res.filter((t) => t.id !== node.topic?.id));
        }).catch(console.error);
      }
    }
  }, [node]);

  if (!node) return null;

  const topic = node.topic;
  const prep = node.preparation;

  const handleSaveNotes = async () => {
    if (!topic) return;
    setIsSavingNotes(true);
    setSaveSuccess(false);

    try {
      // 1. Update global canonical notes
      await api.updateTopic(topic.id, {
        general_notes: globalNotes
      });

      // 2. Update exam-specific personal notes
      await api.updatePreparation(activeExamId, topic.id, {
        personal_notes: personalNotes
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      onRefresh();
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleUpdatePreparation = async (newStatus: string, newConf: number) => {
    if (!topic) return;
    setStatus(newStatus);
    setConfidence(newConf);

    try {
      await api.updatePreparation(activeExamId, topic.id, {
        status: newStatus as any,
        confidence_score: newConf
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to update preparation status:', err);
    }
  };

  const handleAddPrerequisite = async () => {
    if (!topic || !selectedPrereqId) return;
    try {
      await api.addPrerequisite(topic.id, selectedPrereqId);
      const updated = await api.getPrerequisites(topic.id);
      setPrereqs(updated);
      setSelectedPrereqId('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error adding prerequisite');
    }
  };

  const handleRemovePrerequisite = async (prereqTopicId: string) => {
    if (!topic) return;
    try {
      await api.removePrerequisite(topic.id, prereqTopicId);
      setPrereqs((prev) => prev.filter((p) => p.prerequisite_topic_id !== prereqTopicId));
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveFromSyllabus = async () => {
    if (confirm(`Remove '${node.title}' from ${activeExamName}'s syllabus? The canonical topic in the knowledge vault will remain untouched.`)) {
      try {
        await api.deleteSyllabusNode(activeExamId, node.id);
        onClose();
        onRefresh();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleDeleteCanonicalTopic = async (force: boolean = false) => {
    if (!topic) return;
    try {
      await api.deleteTopic(topic.id, force);
      onClose();
      onRefresh();
    } catch (err: any) {
      // Catch 409 conflict safety check
      setDeleteWarning(err.message);
      setDeleteConfirmed(true);
    }
  };

  return (
    <>
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[540px] bg-[#0a0d14] border-l-2 border-[#00f0ff] shadow-[-10px_0_30px_rgba(0,0,0,0.8)] z-40 flex flex-col text-slate-200">
        {/* Header HUD */}
        <div className="p-4 bg-[#0e111a] border-b border-[#1e2538] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-6 bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
            <div>
              <div className="text-[10px] font-mono text-[#00f0ff] uppercase tracking-widest glow-cyan">
                TOPIC TELEMETRY // {activeExamName}
              </div>
              <h2 className="text-base font-bold text-white tracking-wide truncate max-w-sm">
                {node.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-4 border-b border-[#1e2538] text-[11px] font-mono uppercase bg-[#131722]">
          <button
            onClick={() => setActiveTab('notes')}
            className={`py-2.5 text-center border-b-2 transition ${
              activeTab === 'notes'
                ? 'border-[#00f0ff] text-[#00f0ff] font-bold glow-cyan bg-[#00f0ff]/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Notes HUD
          </button>
          <button
            onClick={() => setActiveTab('prep')}
            className={`py-2.5 text-center border-b-2 transition ${
              activeTab === 'prep'
                ? 'border-[#fcee0a] text-[#fcee0a] font-bold glow-yellow bg-[#fcee0a]/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Preparation
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`py-2.5 text-center border-b-2 transition ${
              activeTab === 'usage'
                ? 'border-purple-400 text-purple-400 font-bold bg-purple-400/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Used In ({usageData?.used_in_exams.length || 1})
          </button>
          <button
            onClick={() => setActiveTab('prereqs')}
            className={`py-2.5 text-center border-b-2 transition ${
              activeTab === 'prereqs'
                ? 'border-emerald-400 text-emerald-400 font-bold bg-emerald-400/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Prereqs ({prereqs.length})
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: NOTES HUD */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              {/* Section 5: Global Notes */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#00f0ff]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#00f0ff] glow-cyan">
                      Global Knowledge Notes
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-black/40 px-2 py-0.5 border border-slate-800">
                    Synced across ALL exams
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">
                  General definitions, theoretical complexity, code algorithms, and formulas.
                </p>
                <textarea
                  rows={6}
                  value={globalNotes}
                  onChange={(e) => setGlobalNotes(e.target.value)}
                  placeholder="Universal concept notes..."
                  className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff] p-3 text-xs text-white placeholder-slate-600 focus:outline-none"
                />
              </div>

              {/* Section 5: Exam-Specific Personal Notes */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#fcee0a]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#fcee0a] glow-yellow">
                      Exam-Specific Notes ({activeExamName})
                    </span>
                  </div>
                  <span className="text-[10px] text-yellow-400/80 bg-yellow-950/40 px-2 py-0.5 border border-yellow-700/50">
                    Isolated to {activeExamName}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">
                  PYQ observations, question pitfalls, and exam-specific shortcuts.
                </p>
                <textarea
                  rows={5}
                  value={personalNotes}
                  onChange={(e) => setPersonalNotes(e.target.value)}
                  placeholder={`Personal tips and notes specifically for ${activeExamName}...`}
                  className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#fcee0a] p-3 text-xs text-white placeholder-slate-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {saveSuccess ? (
                  <span className="text-xs text-green-400 flex items-center gap-1.5 font-mono">
                    <CheckCircle className="w-4 h-4" /> NOTES BUFFER COMMITTED
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500 font-mono">
                    Unsaved edits exist locally
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                  className="px-4 py-2 bg-[#00f0ff] text-black font-bold text-xs uppercase flex items-center gap-2 hover:bg-cyan-300 transition glow-cyan"
                >
                  <Save className="w-4 h-4" />
                  {isSavingNotes ? 'SAVING...' : '[ SAVE ALL NOTES ]'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: PREPARATION & REVISIONS */}
          {activeTab === 'prep' && (
            <div className="space-y-4">
              {/* Preparation Status Picker */}
              <div className="p-3 bg-[#131722] border border-[#1e2538] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-slate-400">Mastery Status:</span>
                  <select
                    value={status}
                    onChange={(e) => handleUpdatePreparation(e.target.value, confidence)}
                    className="bg-[#0e111a] border border-[#1e2538] text-xs px-2.5 py-1 text-white font-mono uppercase focus:border-[#00f0ff]"
                  >
                    <option value="not_started">⚪ NOT STARTED</option>
                    <option value="learning">🔵 LEARNING</option>
                    <option value="reviewing">🟡 REVIEWING</option>
                    <option value="completed">🟢 COMPLETED / MASTERED</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-slate-400">Confidence Rating:</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleUpdatePreparation(status, s)}
                        className={`p-1 ${s <= confidence ? 'text-yellow-400' : 'text-slate-600'}`}
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#1e2538]">
                  <div>
                    <span className="text-slate-500">Revisions Logged:</span>{' '}
                    <span className="font-bold text-white font-mono">{prep?.revision_count || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Last Revised:</span>{' '}
                    <span className="text-slate-300 font-mono">
                      {prep?.last_revised_at
                        ? new Date(prep.last_revised_at).toLocaleDateString()
                        : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Big Action: Mark as Revised */}
              <button
                type="button"
                onClick={() => setIsRevisionModalOpen(true)}
                className="w-full py-3 bg-[#fcee0a] hover:bg-yellow-300 text-black font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition glow-yellow shadow-lg"
              >
                <RefreshCw className="w-4 h-4" /> [ LOG REVISION SESSION ]
              </button>

              {/* Revision History Log */}
              <div>
                <h4 className="text-xs font-mono uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#00f0ff]" /> Revision History Timeline
                </h4>
                {prep?.revisions && prep.revisions.length > 0 ? (
                  <div className="space-y-2">
                    {prep.revisions.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-2.5 bg-[#131722] border border-[#1e2538] text-xs space-y-1 font-mono"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-cyan-400">
                            {new Date(rev.revised_at).toLocaleString()}
                          </span>
                          <span className="text-yellow-400">
                            Conf: {rev.confidence_before} → {rev.confidence_after}/5
                          </span>
                        </div>
                        {rev.revision_notes && (
                          <div className="text-slate-300 font-sans text-xs pt-1">
                            {rev.revision_notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center bg-[#131722] border border-[#1e2538] text-xs text-slate-500 font-mono">
                    NO REVISION EVENTS RECORDED YET FOR THIS EXAM
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: USED IN (Cross-Exam Usage) */}
          {activeTab === 'usage' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400">
                Canonical topic <span className="text-white font-bold">"{topic?.title}"</span> is currently deployed in the following examination syllabuses:
              </div>

              <div className="space-y-2">
                {usageData?.used_in_exams.map((u) => {
                  const isCurrent = u.exam_id === activeExamId;
                  return (
                    <div
                      key={u.exam_id}
                      className={`p-3 border transition ${
                        isCurrent
                          ? 'bg-[#00f0ff]/10 border-[#00f0ff]'
                          : 'bg-[#131722] border-[#1e2538] hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">{u.exam_name}</span>
                        {isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-[#00f0ff] text-black font-bold uppercase">
                            Active Exam
                          </span>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-400">
                        <div>
                          Status:{' '}
                          <span className="text-cyan-300 font-semibold uppercase">{u.preparation_status}</span>
                        </div>
                        <div>
                          Conf: <span className="text-yellow-300">{u.confidence_score}/5</span>
                        </div>
                        <div>
                          Revs: <span className="text-white">{u.revision_count}</span>
                        </div>
                      </div>

                      {!isCurrent && onSwitchExam && (
                        <div className="mt-3 pt-2 border-t border-[#1e2538] flex justify-end">
                          <button
                            type="button"
                            onClick={() => onSwitchExam(u.exam_id)}
                            className="text-xs text-[#00f0ff] hover:underline flex items-center gap-1 font-mono uppercase"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Switch to {u.exam_name}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: PREREQUISITES */}
          {activeTab === 'prereqs' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                  Add Prerequisite Canonical Topic:
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedPrereqId}
                    onChange={(e) => setSelectedPrereqId(e.target.value)}
                    className="flex-1 bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff] px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="">-- Select Prerequisite --</option>
                    {allTopics
                      .filter((t) => !prereqs.some((p) => p.prerequisite_topic_id === t.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddPrerequisite}
                    disabled={!selectedPrereqId}
                    className="px-3 py-1.5 bg-[#00f0ff] text-black font-bold text-xs uppercase disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-mono uppercase text-slate-400">
                  Prerequisites Required for this Topic:
                </span>
                {prereqs.length === 0 ? (
                  <div className="p-4 text-center bg-[#131722] border border-[#1e2538] text-xs text-slate-500 font-mono">
                    NO PREREQUISITE DEPENDENCIES DEFINED
                  </div>
                ) : (
                  prereqs.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 bg-[#131722] border border-[#1e2538] flex items-center justify-between text-xs"
                    >
                      <span className="text-white font-semibold">{p.prerequisite_title}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePrerequisite(p.prerequisite_topic_id)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions / Deletion Safety */}
        <div className="p-4 bg-[#0e111a] border-t border-[#1e2538] space-y-2">
          {deleteWarning && (
            <div className="p-3 bg-red-950/70 border border-red-500 text-xs text-red-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Deletion Safety Alert!</span>
              </div>
              <p className="text-[11px]">{deleteWarning}</p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteWarning(null)}
                  className="px-2.5 py-1 bg-slate-800 text-white text-[11px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCanonicalTopic(true)}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] uppercase"
                >
                  Force Delete Everywhere
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleRemoveFromSyllabus}
              className="text-slate-400 hover:text-white underline font-mono text-[11px]"
            >
              [ Detach from this Exam ]
            </button>
            <button
              type="button"
              onClick={() => handleDeleteCanonicalTopic(false)}
              className="text-red-400 hover:text-red-300 flex items-center gap-1 font-mono text-[11px]"
            >
              <Trash2 className="w-3.5 h-3.5" /> [ Delete Canonical ]
            </button>
          </div>
        </div>
      </div>

      {/* Revision Session Modal */}
      {topic && (
        <RevisionModal
          isOpen={isRevisionModalOpen}
          onClose={() => setIsRevisionModalOpen(false)}
          examId={activeExamId}
          examName={activeExamName}
          topicId={topic.id}
          topicTitle={topic.title}
          currentConfidence={confidence}
          onSuccess={() => {
            onRefresh();
            // Re-fetch prep
            api.getPreparation(activeExamId, topic.id).then((p) => {
              setStatus(p.status);
              setConfidence(p.confidence_score);
            });
          }}
        />
      )}
    </>
  );
};
