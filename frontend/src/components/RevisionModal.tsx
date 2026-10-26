import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Star, Calendar, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import { TopicUsageResponse } from '../types';

interface RevisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  examId: string;
  examName: string;
  topicId: string;
  topicTitle: string;
  currentConfidence: number;
  onSuccess: () => void;
}

export const RevisionModal: React.FC<RevisionModalProps> = ({
  isOpen,
  onClose,
  examId,
  examName,
  topicId,
  topicTitle,
  currentConfidence,
  onSuccess
}) => {
  const [revisionNotes, setRevisionNotes] = useState('');
  const [confBefore, setConfBefore] = useState(currentConfidence);
  const [confAfter, setConfAfter] = useState(Math.min(5, currentConfidence + 1));
  const [intervalPreset, setIntervalPreset] = useState<number | null>(null);
  const [customDays, setCustomDays] = useState<number>(7);

  // Other examinations sharing this topic
  const [usageData, setUsageData] = useState<TopicUsageResponse | null>(null);
  const [selectedOtherExamIds, setSelectedOtherExamIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && topicId) {
      setConfBefore(currentConfidence);
      setConfAfter(Math.min(5, currentConfidence + 1));
      setRevisionNotes('');
      setSelectedOtherExamIds([]);
      // Fetch where topic is used
      api.getTopicUsage(topicId).then(setUsageData).catch(console.error);
    }
  }, [isOpen, topicId, currentConfidence]);

  if (!isOpen) return null;

  const otherExams = usageData?.used_in_exams.filter((u) => u.exam_id !== examId) || [];

  const toggleOtherExam = (id: string) => {
    setSelectedOtherExamIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const days = intervalPreset !== null ? intervalPreset : customDays;
      await api.recordRevision(examId, topicId, {
        revision_notes: revisionNotes.trim(),
        confidence_before: confBefore,
        confidence_after: confAfter,
        spaced_interval_days: days,
        also_revise_exam_ids: selectedOtherExamIds
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record revision');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg bg-[#0e111a] border-2 border-[#fcee0a] shadow-[0_0_30px_rgba(252,238,10,0.2)] cyber-chamfer p-6 text-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-[#1e2538]">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-[#fcee0a] animate-spin-slow" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#fcee0a] glow-yellow">
              Neural Calibration // Log Revision
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3 mb-4 p-2.5 bg-[#131722] border border-[#1e2538] text-xs">
          <span className="text-slate-400">Target Topic:</span>{' '}
          <span className="font-bold text-white">{topicTitle}</span>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Primary Examination: <span className="text-cyan-400">{examName}</span>
          </div>
        </div>

        {error && (
          <div className="p-2 mb-3 bg-red-950/60 border border-red-500 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Confidence Adjustment */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-[#131722] border border-[#1e2538]">
            <div>
              <label className="block text-[11px] text-slate-400 uppercase mb-1">Confidence Before</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setConfBefore(lvl)}
                    className={`p-1 ${lvl <= confBefore ? 'text-yellow-400' : 'text-slate-600'}`}
                  >
                    <Star className="w-4 h-4 fill-current" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 uppercase mb-1">Confidence After</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setConfAfter(lvl)}
                    className={`p-1 ${lvl <= confAfter ? 'text-yellow-400' : 'text-slate-600'}`}
                  >
                    <Star className="w-4 h-4 fill-current" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Spaced Repetition Presets */}
          <div>
            <label className="block text-slate-400 uppercase mb-1">
              Next Revision Interval (Spaced Repetition)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '+1 Day', val: 1 },
                { label: '+3 Days', val: 3 },
                { label: '+7 Days', val: 7 },
                { label: '+14 Days', val: 14 }
              ].map((preset) => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => {
                    setIntervalPreset(preset.val);
                    setCustomDays(preset.val);
                  }}
                  className={`py-1.5 px-2 border text-center font-mono ${
                    intervalPreset === preset.val
                      ? 'bg-[#fcee0a]/20 border-[#fcee0a] text-[#fcee0a] font-bold'
                      : 'border-[#1e2538] bg-[#131722] text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Revision Notes */}
          <div>
            <label className="block text-slate-400 uppercase mb-1">
              Revision Log Notes (Exam Observations, PYQs, Formula Recaps)
            </label>
            <textarea
              rows={3}
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="e.g., Reviewed worst-case recurrence relations and solved 5 previous year GATE questions..."
              className="w-full bg-[#131722] border border-[#1e2538] focus:border-[#fcee0a] p-2 text-white placeholder-slate-600 focus:outline-none"
            />
          </div>

          {/* Section 6 Requirement: Optional Multi-Exam Revision */}
          {otherExams.length > 0 && (
            <div className="p-3 bg-cyan-950/20 border border-cyan-800/50 space-y-2">
              <div className="font-bold text-cyan-300 uppercase tracking-wider text-[11px]">
                Multi-Examination Revision Option
              </div>
              <p className="text-[11px] text-slate-400">
                This topic is also part of other exam syllabuses. Select if you want to record an independent revision event for them as well:
              </p>
              <div className="space-y-1.5 mt-1">
                {otherExams.map((oe) => {
                  const isChecked = selectedOtherExamIds.includes(oe.exam_id);
                  return (
                    <div
                      key={oe.exam_id}
                      onClick={() => toggleOtherExam(oe.exam_id)}
                      className={`p-2 border cursor-pointer flex items-center justify-between transition ${
                        isChecked
                          ? 'bg-[#00f0ff]/10 border-[#00f0ff] text-white'
                          : 'bg-[#131722] border-[#1e2538] text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-[#00f0ff]" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600" />
                        )}
                        <span className="font-semibold">{oe.exam_name}</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 bg-black/40 text-slate-400 uppercase">
                        Current: {oe.preparation_status} (Rev #{oe.revision_count})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-3 flex justify-end gap-3 border-t border-[#1e2538]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-700 text-slate-300 uppercase hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#fcee0a] text-black font-bold uppercase hover:bg-yellow-300 transition glow-yellow"
            >
              {loading ? 'CALIBRATING...' : '[ RECORD REVISION ]'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
