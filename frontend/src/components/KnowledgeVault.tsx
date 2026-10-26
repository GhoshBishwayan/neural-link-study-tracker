import React, { useState, useEffect } from 'react';
import {
  BookOpen, Search, Plus, Star, Clock, Layers,
  Trash2, Edit3, Save, AlertTriangle, ExternalLink, CheckCircle
} from 'lucide-react';
import { KnowledgeTopic, TopicUsageResponse } from '../types';
import { api } from '../api/client';

export const KnowledgeVault: React.FC = () => {
  const [topics, setTopics] = useState<KnowledgeTopic[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<KnowledgeTopic | null>(null);
  const [usage, setUsage] = useState<TopicUsageResponse | null>(null);

  // Edit canonical topic state
  const [title, setTitle] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [difficulty, setDifficulty] = useState(2);
  const [priority, setPriority] = useState(3);
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Deletion safety state
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchTopics = async () => {
    try {
      setLoading(true);
      const data = await api.getTopics(search);
      setTopics(data);
      if (!selectedTopic && data.length > 0) {
        selectTopic(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, [search]);

  const selectTopic = async (t: KnowledgeTopic) => {
    setSelectedTopic(t);
    setTitle(t.title);
    setGeneralNotes(t.general_notes || '');
    setDifficulty(t.difficulty);
    setPriority(t.priority);
    setEstimatedMinutes(t.estimated_minutes);
    setDeleteError(null);

    try {
      const u = await api.getTopicUsage(t.id);
      setUsage(u);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopic) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updated = await api.updateTopic(selectedTopic.id, {
        title,
        general_notes: generalNotes,
        difficulty,
        priority,
        estimated_minutes: estimatedMinutes
      });
      setSelectedTopic(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      fetchTopics();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (force: boolean = false) => {
    if (!selectedTopic) return;
    try {
      await api.deleteTopic(selectedTopic.id, force);
      setSelectedTopic(null);
      setDeleteError(null);
      fetchTopics();
    } catch (err: any) {
      setDeleteError(err.message);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      {/* HUD Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#0e111a] border border-[#1e2538] cyber-chamfer">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-6 bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
          <div>
            <div className="text-[10px] font-mono text-[#00f0ff] uppercase tracking-widest glow-cyan">
              CENTRAL REPOSITORY // CANONICAL KNOWLEDGE
            </div>
            <h1 className="text-base font-bold text-white uppercase tracking-wider">
              Canonical Knowledge Vault
            </h1>
          </div>
        </div>

        <div className="text-xs font-mono text-slate-400">
          Total Canonical Topics: <span className="font-bold text-[#00f0ff]">{topics.length}</span>
        </div>
      </div>

      {/* Main Grid: Left Catalog / Right Inspector */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Column: Topics Search & Catalog */}
        <div className="md:col-span-5 space-y-3">
          <div className="flex items-center bg-[#0e111a] border border-[#1e2538] px-3 py-2">
            <Search className="w-3.5 h-3.5 text-slate-500 mr-2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search canonical vault..."
              className="w-full bg-transparent border-none text-xs text-white focus:outline-none placeholder-slate-600 font-mono"
            />
          </div>

          <div className="border border-[#1e2538] bg-[#07080c] divide-y divide-[#1e2538] max-h-[70vh] overflow-y-auto">
            {topics.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-slate-500">
                {loading ? 'RETRIEVING VAULT RECORDS...' : 'NO MATCHING TOPICS'}
              </div>
            ) : (
              topics.map((t) => (
                <div
                  key={t.id}
                  onClick={() => selectTopic(t)}
                  className={`p-3 cursor-pointer transition ${
                    selectedTopic?.id === t.id
                      ? 'bg-[#00f0ff]/10 border-l-4 border-l-[#00f0ff]'
                      : 'hover:bg-[#131722]'
                  }`}
                >
                  <div className="font-bold text-xs text-white flex items-center justify-between mb-1">
                    <span className="truncate">{t.title}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-400 font-mono">
                      Diff {t.difficulty}/5
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                    <span>Est. {t.estimated_minutes} min</span>
                    <span className="text-[#00f0ff]">
                      {t.usage_count ? `Used in ${t.usage_count} exam(s)` : 'Vault Only'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Canonical Topic Details & Editor */}
        <div className="md:col-span-7">
          {selectedTopic ? (
            <div className="p-5 bg-[#0e111a] border border-[#1e2538] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#1e2538]">
                <div>
                  <div className="text-[10px] font-mono text-[#00f0ff] uppercase tracking-widest">
                    CANONICAL ENTITY // ID: {selectedTopic.id.slice(0, 8)}...
                  </div>
                  <h2 className="text-base font-bold text-white">{selectedTopic.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(false)}
                  className="text-red-400 hover:text-red-300 font-mono text-xs flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> [ DELETE ]
                </button>
              </div>

              {deleteError && (
                <div className="p-3 bg-red-950/60 border border-red-500 text-xs text-red-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-red-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Deletion Safety Guard</span>
                  </div>
                  <p className="text-[11px]">{deleteError}</p>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setDeleteError(null)}
                      className="px-2.5 py-1 bg-slate-800 text-white text-[11px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(true)}
                      className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] uppercase"
                    >
                      Confirm Force Delete
                    </button>
                  </div>
                </div>
              )}

              {/* Cross-Exam Deployments Card */}
              <div className="p-3 bg-[#131722] border border-[#1e2538] space-y-2">
                <span className="text-xs font-mono uppercase text-slate-400">
                  Deployed in Examination Syllabuses:
                </span>
                {usage?.used_in_exams && usage.used_in_exams.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {usage.used_in_exams.map((u) => (
                      <div
                        key={u.exam_id}
                        className="p-2 bg-black/40 border border-[#1e2538] text-xs font-mono"
                      >
                        <div className="font-bold text-white text-[11px]">{u.exam_name}</div>
                        <div className="text-[10px] text-cyan-300 mt-1 uppercase">
                          Status: {u.preparation_status} (Rev #{u.revision_count})
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 font-mono">
                    This canonical topic has not been linked to any examination yet.
                  </div>
                )}
              </div>

              {/* Form to edit canonical properties & universal notes */}
              <form onSubmit={handleSave} className="space-y-4 text-xs font-mono">
                <div>
                  <label className="block uppercase text-slate-400 mb-1">Topic Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff] px-3 py-2 text-white font-sans text-xs focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block uppercase text-slate-400 mb-1">Difficulty (1-5)</label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(Number(e.target.value))}
                      className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff] px-2 py-1.5 text-white text-xs"
                    >
                      {[1, 2, 3, 4, 5].map((d) => (
                        <option key={d} value={d}>Level {d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block uppercase text-slate-400 mb-1">Priority (1-5)</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(Number(e.target.value))}
                      className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff] px-2 py-1.5 text-white text-xs"
                    >
                      {[1, 2, 3, 4, 5].map((p) => (
                        <option key={p} value={p}>P{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block uppercase text-slate-400 mb-1">Est. Minutes</label>
                    <input
                      type="number"
                      value={estimatedMinutes}
                      onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                      className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff] px-2 py-1.5 text-white text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block uppercase text-[#00f0ff] mb-1 flex items-center justify-between">
                    <span>Global Canonical Knowledge Notes</span>
                    <span className="text-[10px] text-slate-500 font-normal">Propagates to all exams</span>
                  </label>
                  <textarea
                    rows={8}
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    placeholder="Universal concept notes, algorithms, code snippets, complexity..."
                    className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff] p-3 text-white placeholder-slate-600 focus:outline-none font-sans text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  {saveSuccess && (
                    <span className="text-green-400 flex items-center gap-1.5 text-xs">
                      <CheckCircle className="w-4 h-4" /> CANONICAL RECORD UPDATED
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 bg-[#00f0ff] hover:bg-cyan-300 text-black font-bold uppercase text-xs flex items-center gap-2 ml-auto glow-cyan transition"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'SAVING...' : '[ SAVE CANONICAL TOPIC ]'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="p-12 text-center bg-[#0e111a] border border-[#1e2538] text-xs font-mono text-slate-500">
              SELECT A CANONICAL TOPIC FROM THE VAULT CATALOG TO VIEW OR EDIT
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
