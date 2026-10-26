import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Link as LinkIcon, AlertTriangle, CheckCircle, BookOpen } from 'lucide-react';
import { api } from '../api/client';
import { KnowledgeTopic, DuplicateCheckResponse, ExamSubject } from '../types';

interface CreateOrLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  examId: string;
  examSubjects: ExamSubject[];
  parentNodeId?: string | null;
  positionX?: number;
  positionY?: number;
  onSuccess: () => void;
}

export const CreateOrLinkModal: React.FC<CreateOrLinkModalProps> = ({
  isOpen,
  onClose,
  examId,
  examSubjects,
  parentNodeId,
  positionX = 200,
  positionY = 200,
  onSuccess
}) => {
  const [mode, setMode] = useState<'create' | 'link'>('create');
  
  // Create mode state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [difficulty, setDifficulty] = useState(2);
  const [priority, setPriority] = useState(3);
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [isOrganizational, setIsOrganizational] = useState(false);

  // Duplicate detection state
  const [duplicateCheck, setDuplicateCheck] = useState<DuplicateCheckResponse | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [ignoreDuplicateWarning, setIgnoreDuplicateWarning] = useState(false);

  // Link mode state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeTopic[]>([]);
  const [selectedTopicToLink, setSelectedTopicToLink] = useState<KnowledgeTopic | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (examSubjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(examSubjects[0].id);
    }
  }, [examSubjects]);

  // Real-time duplicate check when title changes in create mode
  useEffect(() => {
    if (mode !== 'create' || !title.trim() || isOrganizational) {
      setDuplicateCheck(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsCheckingDuplicate(true);
        const res = await api.checkDuplicate(title);
        setDuplicateCheck(res);
      } catch (err) {
        console.error('Duplicate check error:', err);
      } finally {
        setIsCheckingDuplicate(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [title, mode, isOrganizational]);

  // Search canonical topics in link mode
  useEffect(() => {
    if (mode !== 'link') return;

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const results = await api.getTopics(searchQuery);
        setSearchResults(results);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, mode]);

  if (!isOpen) return null;

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError(null);

    try {
      if (isOrganizational) {
        // Create organizational syllabus node
        await api.addSyllabusNode(examId, {
          exam_subject_id: selectedSubjectId || undefined,
          parent_node_id: parentNodeId,
          title: title.trim(),
          position_x: positionX,
          position_y: positionY,
          is_organizational: true,
          is_required: true
        });
      } else {
        // Create canonical topic and link to syllabus
        await api.createAndLinkTopic(examId, {
          topic: {
            title: title.trim(),
            description: description.trim() || undefined,
            general_notes: generalNotes.trim(),
            difficulty,
            priority,
            estimated_minutes: estimatedMinutes
          },
          exam_subject_id: selectedSubjectId || undefined,
          parent_node_id: parentNodeId,
          position_x: positionX,
          position_y: positionY,
          is_required: true
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create topic');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkExistingTopic = async (topic: KnowledgeTopic) => {
    setLoading(true);
    setError(null);

    try {
      await api.addSyllabusNode(examId, {
        exam_subject_id: selectedSubjectId || undefined,
        topic_id: topic.id,
        parent_node_id: parentNodeId,
        title: topic.title,
        position_x: positionX,
        position_y: positionY,
        is_organizational: false,
        is_required: true
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to link topic');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl bg-[#0e111a] border-2 border-[#1e2538] shadow-[0_0_30px_rgba(0,240,255,0.15)] cyber-chamfer p-6 text-slate-100 max-h-[90vh] flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1e2538]">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-6 bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
            <h2 className="text-lg font-bold tracking-widest text-[#00f0ff] uppercase glow-cyan">
              Syllabus Protocol // Add Topic
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-2 my-4">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`py-2 px-4 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition ${
              mode === 'create'
                ? 'bg-[#fcee0a]/10 border-[#fcee0a] text-[#fcee0a] glow-yellow font-bold'
                : 'bg-[#131722] border-[#1e2538] text-slate-400 hover:border-slate-600'
            }`}
          >
            <Plus className="w-4 h-4" /> [ CREATE NEW TOPIC ]
          </button>
          <button
            type="button"
            onClick={() => setMode('link')}
            className={`py-2 px-4 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition ${
              mode === 'link'
                ? 'bg-[#00f0ff]/10 border-[#00f0ff] text-[#00f0ff] glow-cyan font-bold'
                : 'bg-[#131722] border-[#1e2538] text-slate-400 hover:border-slate-600'
            }`}
          >
            <LinkIcon className="w-4 h-4" /> [ LINK EXISTING TOPIC ]
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-950/60 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-1">
          {mode === 'create' ? (
            <form onSubmit={handleCreateTopic} className="space-y-4">
              {/* Type Switcher: Canonical Topic vs Organizational Header */}
              <div className="flex items-center gap-4 p-2.5 bg-[#131722] border border-[#1e2538] text-xs">
                <span className="text-slate-400">Node Archetype:</span>
                <label className="flex items-center gap-2 cursor-pointer text-cyan-300">
                  <input
                    type="radio"
                    name="nodeType"
                    checked={!isOrganizational}
                    onChange={() => setIsOrganizational(false)}
                    className="accent-[#00f0ff]"
                  />
                  Canonical Knowledge Topic
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-yellow-300">
                  <input
                    type="radio"
                    name="nodeType"
                    checked={isOrganizational}
                    onChange={() => setIsOrganizational(true)}
                    className="accent-[#fcee0a]"
                  />
                  Organizational Branch (Folder / Unit)
                </label>
              </div>

              {/* Title input */}
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                  Topic Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setIgnoreDuplicateWarning(false);
                  }}
                  placeholder={isOrganizational ? "e.g., Searching Algorithms, Module 3" : "e.g., Binary Search"}
                  className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff] focus:outline-none px-3 py-2 text-sm text-white placeholder-slate-600"
                />
              </div>

              {/* Duplicate Detection Warning Banner */}
              {!isOrganizational && duplicateCheck && (duplicateCheck.exact_match || duplicateCheck.similar_matches.length > 0) && !ignoreDuplicateWarning && (
                <div className="p-3 bg-yellow-950/40 border border-yellow-500/60 text-xs text-yellow-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-yellow-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Potential Duplicate Detected in Knowledge Vault!</span>
                  </div>
                  <p className="text-[11px] text-yellow-300/80">
                    A matching canonical topic already exists. You can link the existing topic (recommended to share knowledge across exams) or create a separate topic.
                  </p>

                  {duplicateCheck.exact_match && (
                    <div className="p-2 bg-black/40 border border-yellow-500/30 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white">{duplicateCheck.exact_match.title} (Exact Match)</div>
                        <div className="text-[10px] text-slate-400">
                          {duplicateCheck.exact_match.used_in_exams.length > 0 ? (
                            <span>Used in: {duplicateCheck.exact_match.used_in_exams.join(', ')}</span>
                          ) : (
                            <span>Not yet linked to any exam</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleLinkExistingTopic({ id: duplicateCheck.exact_match!.id, title: duplicateCheck.exact_match!.title } as KnowledgeTopic)}
                        className="px-2.5 py-1 bg-[#fcee0a] text-black font-bold text-xs uppercase hover:bg-yellow-300"
                      >
                        [ LINK THIS TOPIC ]
                      </button>
                    </div>
                  )}

                  {duplicateCheck.similar_matches.slice(0, 2).map((sim) => (
                    <div key={sim.id} className="p-2 bg-black/40 border border-yellow-500/20 flex items-center justify-between">
                      <div>
                        <div className="text-slate-200 font-semibold">{sim.title} ({Math.round(sim.similarity_score * 100)}% match)</div>
                        <div className="text-[10px] text-slate-400">Used in: {sim.used_in_exams.join(', ') || 'Vault only'}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleLinkExistingTopic({ id: sim.id, title: sim.title } as KnowledgeTopic)}
                        className="px-2 py-0.5 border border-[#00f0ff] text-[#00f0ff] text-[11px] hover:bg-[#00f0ff]/10"
                      >
                        Link
                      </button>
                    </div>
                  ))}

                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIgnoreDuplicateWarning(true)}
                      className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Ignore & create separate topic
                    </button>
                  </div>
                </div>
              )}

              {/* Subject Association */}
              {examSubjects.length > 0 && (
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                    Subject Association (Current Exam)
                  </label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff] focus:outline-none px-3 py-2 text-xs text-white"
                  >
                    <option value="">-- No specific subject --</option>
                    {examSubjects.map((es) => (
                      <option key={es.id} value={es.id}>
                        {es.subject_name} {es.syllabus_description ? `(${es.syllabus_description})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!isOrganizational && (
                <>
                  {/* Difficulty & Priority */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Difficulty (1-5)</label>
                      <select
                        value={difficulty}
                        onChange={(e) => setDifficulty(Number(e.target.value))}
                        className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff] px-2 py-1.5 text-xs text-white"
                      >
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <option key={lvl} value={lvl}>Level {lvl}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Priority (1-5)</label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(Number(e.target.value))}
                        className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff] px-2 py-1.5 text-xs text-white"
                      >
                        {[1, 2, 3, 4, 5].map((p) => (
                          <option key={p} value={p}>P{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">Est. Minutes</label>
                      <input
                        type="number"
                        min="5"
                        step="5"
                        value={estimatedMinutes}
                        onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                        className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff] px-2 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  {/* General Knowledge Notes */}
                  <div>
                    <label className="block text-xs font-mono uppercase text-[#00f0ff] mb-1 flex items-center justify-between">
                      <span>Global Knowledge Notes (Shared Across All Exams)</span>
                      <span className="text-[10px] text-slate-500 font-normal">Markdown supported</span>
                    </label>
                    <textarea
                      rows={3}
                      value={generalNotes}
                      onChange={(e) => setGeneralNotes(e.target.value)}
                      placeholder="Core definitions, algorithms, complexity analysis (will be visible in any exam linking this topic)..."
                      className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff] focus:outline-none p-2.5 text-xs text-white placeholder-slate-600"
                    />
                  </div>
                </>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-700 text-slate-300 text-xs uppercase hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-[#00f0ff] text-black font-bold text-xs uppercase hover:bg-cyan-300 transition glow-cyan"
                >
                  {loading ? 'INITIALIZING...' : '[ COMMIT NEW TOPIC ]'}
                </button>
              </div>
            </form>
          ) : (
            /* Link Existing Topic Mode */
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search existing canonical topics in Knowledge Vault..."
                  className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff] focus:outline-none pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600"
                />
              </div>

              {examSubjects.length > 0 && (
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                    Associate with Subject in Current Exam:
                  </label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff] px-3 py-2 text-xs text-white"
                  >
                    <option value="">-- No specific subject --</option>
                    {examSubjects.map((es) => (
                      <option key={es.id} value={es.id}>
                        {es.subject_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {isSearching ? (
                  <div className="text-center py-6 text-xs text-slate-500 font-mono">SEARCHING VAULT...</div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 font-mono">
                    {searchQuery ? 'NO MATCHING TOPICS FOUND' : 'TYPE TO SEARCH KNOWLEDGE VAULT'}
                  </div>
                ) : (
                  searchResults.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 bg-[#131722] border border-[#1e2538] hover:border-[#00f0ff]/50 flex items-center justify-between group transition"
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-white text-xs flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-[#00f0ff]" />
                          <span>{t.title}</span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-400">Diff: {t.difficulty}/5</span>
                        </div>
                        {t.description && (
                          <div className="text-[11px] text-slate-400 line-clamp-1">{t.description}</div>
                        )}
                        <div className="text-[10px] text-slate-500">
                          {t.usage_count ? `Used in ${t.usage_count} syllabus branch(es)` : 'Reusable topic'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleLinkExistingTopic(t)}
                        disabled={loading}
                        className="px-3 py-1.5 bg-[#00f0ff]/10 border border-[#00f0ff] text-[#00f0ff] text-xs font-bold uppercase hover:bg-[#00f0ff] hover:text-black transition"
                      >
                        [ LINK ]
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
