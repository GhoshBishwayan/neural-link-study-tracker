import React, { useState } from 'react';
import {
  GitBranch, List, BookOpen, BarChart3, Database,
  Plus, Calendar, ChevronDown, Award
} from 'lucide-react';
import { Examination } from '../types';
import { api } from '../api/client';

interface NavbarProps {
  examinations: Examination[];
  activeExam: Examination | null;
  activeTab: 'tree' | 'list' | 'vault' | 'dashboard' | 'backup';
  onSelectExam: (exam: Examination) => void;
  onSelectTab: (tab: 'tree' | 'list' | 'vault' | 'dashboard' | 'backup') => void;
  onRefreshExams: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  examinations,
  activeExam,
  activeTab,
  onSelectExam,
  onSelectTab,
  onRefreshExams
}) => {
  const [isNewExamModalOpen, setIsNewExamModalOpen] = useState(false);
  const [newExamName, setNewExamName] = useState('');
  const [newExamDate, setNewExamDate] = useState('');
  const [newExamDesc, setNewExamDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamName.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await api.createExamination({
        name: newExamName.trim(),
        exam_date: newExamDate.trim() || undefined,
        description: newExamDesc.trim() || undefined
      });
      setIsNewExamModalOpen(false);
      setNewExamName('');
      setNewExamDate('');
      setNewExamDesc('');
      onRefreshExams();
      onSelectExam(created);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <header className="h-16 bg-[#0a0d14] border-b-2 border-[#1e2538] flex items-center justify-between px-4 z-30 select-none">
        {/* Left: Brand & Exam Selector */}
        <div className="flex items-center gap-6">
          {/* Cyberpunk Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSelectTab('tree')}>
            <div className="w-3 h-6 bg-[#fcee0a] shadow-[0_0_10px_#fcee0a]" />
            <span className="font-mono font-black text-lg tracking-widest text-white">
              NEURO<span className="text-[#fcee0a] glow-yellow">//</span>TREE
            </span>
          </div>

          {/* Active Examination Dropdown */}
          <div className="flex items-center gap-2 bg-[#0e111a] border border-[#1e2538] px-3 py-1.5 font-mono text-xs">
            <span className="text-slate-500 uppercase text-[10px]">EXAM:</span>
            <select
              value={activeExam?.id || ''}
              onChange={(e) => {
                const found = examinations.find((x) => x.id === e.target.value);
                if (found) onSelectExam(found);
              }}
              className="bg-transparent text-[#00f0ff] font-bold uppercase focus:outline-none cursor-pointer"
            >
              {examinations.map((ex) => (
                <option key={ex.id} value={ex.id} className="bg-[#0e111a] text-white">
                  {ex.name} ({ex.progress_percentage || 0}%)
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setIsNewExamModalOpen(true)}
              className="p-1 text-slate-400 hover:text-[#fcee0a] transition ml-1"
              title="Create New Examination"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: Mode Tabs */}
        <nav className="flex items-center gap-1 font-mono text-xs">
          <button
            onClick={() => onSelectTab('tree')}
            className={`flex items-center gap-2 px-3 py-2 border-b-2 uppercase tracking-wider transition ${
              activeTab === 'tree'
                ? 'border-[#00f0ff] text-[#00f0ff] font-bold glow-cyan bg-[#00f0ff]/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <GitBranch className="w-4 h-4" /> [ SKILL TREE ]
          </button>
          <button
            onClick={() => onSelectTab('list')}
            className={`flex items-center gap-2 px-3 py-2 border-b-2 uppercase tracking-wider transition ${
              activeTab === 'list'
                ? 'border-[#00f0ff] text-[#00f0ff] font-bold glow-cyan bg-[#00f0ff]/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <List className="w-4 h-4" /> [ SYLLABUS LIST ]
          </button>
          <button
            onClick={() => onSelectTab('vault')}
            className={`flex items-center gap-2 px-3 py-2 border-b-2 uppercase tracking-wider transition ${
              activeTab === 'vault'
                ? 'border-[#fcee0a] text-[#fcee0a] font-bold glow-yellow bg-[#fcee0a]/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" /> [ KNOWLEDGE VAULT ]
          </button>
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`flex items-center gap-2 px-3 py-2 border-b-2 uppercase tracking-wider transition ${
              activeTab === 'dashboard'
                ? 'border-emerald-400 text-emerald-400 font-bold bg-emerald-400/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" /> [ DASHBOARD ]
          </button>
          <button
            onClick={() => onSelectTab('backup')}
            className={`flex items-center gap-2 px-3 py-2 border-b-2 uppercase tracking-wider transition ${
              activeTab === 'backup'
                ? 'border-purple-400 text-purple-400 font-bold bg-purple-400/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" /> [ BACKUP / CSV ]
          </button>
        </nav>

        {/* Right: Active Exam Gauge & Telemetry Status */}
        <div className="flex items-center gap-4">
          {activeExam && (
            <div className="hidden lg:flex items-center gap-3 font-mono text-xs">
              <div className="text-right">
                <div className="text-[10px] text-slate-500 uppercase">MASTERY INDEX</div>
                <div className="font-bold text-[#00ff66]">
                  {activeExam.completed_topic_count || 0}/{activeExam.topic_count || 0} (
                  {activeExam.progress_percentage || 0}%)
                </div>
              </div>
              <div className="w-20 bg-[#131722] h-2 border border-[#1e2538] overflow-hidden">
                <div
                  className="h-full bg-[#00ff66] shadow-[0_0_6px_#00ff66]"
                  style={{ width: `${activeExam.progress_percentage || 0}%` }}
                />
              </div>
            </div>
          )}

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-black/60 border border-slate-800 font-mono text-[10px] text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>CORE ONLINE</span>
          </div>
        </div>
      </header>

      {/* New Examination Modal */}
      {isNewExamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0e111a] border-2 border-[#00f0ff] p-6 cyber-chamfer space-y-4">
            <h3 className="text-sm font-bold font-mono uppercase text-[#00f0ff] tracking-wider glow-cyan">
              [ INITIALIZE NEW EXAMINATION ]
            </h3>
            <form onSubmit={handleCreateExam} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-slate-400 uppercase mb-1">Examination Name *</label>
                <input
                  type="text"
                  required
                  value={newExamName}
                  onChange={(e) => setNewExamName(e.target.value)}
                  placeholder="e.g. UPSC CSE, GRE, AWS SAA"
                  className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff] px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 uppercase mb-1">Target Exam Date</label>
                <input
                  type="date"
                  value={newExamDate}
                  onChange={(e) => setNewExamDate(e.target.value)}
                  className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff] px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 uppercase mb-1">Description / Target Goal</label>
                <textarea
                  rows={2}
                  value={newExamDesc}
                  onChange={(e) => setNewExamDesc(e.target.value)}
                  placeholder="Target score, exam format..."
                  className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#00f0ff] px-3 py-2 text-white focus:outline-none font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewExamModalOpen(false)}
                  className="px-4 py-2 border border-slate-700 text-slate-300 uppercase hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#00f0ff] hover:bg-cyan-300 text-black font-bold uppercase glow-cyan"
                >
                  {isSubmitting ? 'CREATING...' : '[ COMMENCE EXAM ]'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
