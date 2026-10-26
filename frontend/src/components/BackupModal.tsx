import React, { useState } from 'react';
import {
  X, Download, Upload, Database, FileSpreadsheet,
  AlertTriangle, CheckCircle, RefreshCw, Layers
} from 'lucide-react';
import { api } from '../api/client';
import { CSVImportPreviewResponse } from '../types';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeExamId?: string;
  onRefresh: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  activeExamId,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'csv'>('backup');

  // Full DB State
  const [isExportingDb, setIsExportingDb] = useState(false);
  const [isRestoringDb, setIsRestoringDb] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CSVImportPreviewResponse | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1. Export Full Database Snapshot
  const handleExportFullDatabase = async () => {
    setIsExportingDb(true);
    try {
      const data = await api.exportFullDatabase();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `neurotree_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Error exporting database backup');
    } finally {
      setIsExportingDb(false);
    }
  };

  // 2. Restore Full Database Snapshot
  const handleRestoreFullDatabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('CAUTION: Restoring will overwrite all existing data in the database with the snapshot. Proceed?')) {
      return;
    }

    setIsRestoringDb(true);
    setRestoreStatus(null);
    try {
      const text = await file.text();
      const backupData = JSON.parse(text);
      await api.restoreFullDatabase(backupData);
      setRestoreStatus('SUCCESS: Full database restored successfully from snapshot!');
      onRefresh();
    } catch (err: any) {
      setRestoreStatus(`ERROR: ${err.message || 'Failed to restore database.'}`);
    } finally {
      setIsRestoringDb(false);
      e.target.value = '';
    }
  };

  // 3. Handle CSV File Selection & Preview
  const handleCsvSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setIsPreviewing(true);
    setCsvMessage(null);

    try {
      const previewData = await api.previewCsv(file);
      setPreview(previewData);
    } catch (err: any) {
      setCsvMessage(`Error previewing CSV: ${err.message}`);
    } finally {
      setIsPreviewing(false);
    }
  };

  // 4. Commit CSV Import
  const handleCommitCsv = async () => {
    if (!preview) return;
    setIsCommitting(true);
    setCsvMessage(null);

    try {
      const res = await api.commitCsv({
        exam_id: activeExamId,
        rows: preview.rows
      });
      setCsvMessage(res.message);
      setPreview(null);
      setCsvFile(null);
      onRefresh();
    } catch (err: any) {
      setCsvMessage(`Failed to commit import: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl bg-[#0e111a] border-2 border-[#00f0ff] shadow-[0_0_30px_rgba(0,240,255,0.2)] cyber-chamfer p-6 text-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1e2538]">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#00f0ff]" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#00f0ff] glow-cyan">
              Data Storage & Migration Protocols
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 gap-2 my-4">
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`py-2 px-4 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition ${
              activeTab === 'backup'
                ? 'bg-[#00f0ff]/10 border-[#00f0ff] text-[#00f0ff] font-bold glow-cyan'
                : 'bg-[#131722] border-[#1e2538] text-slate-400 hover:border-slate-600'
            }`}
          >
            <Database className="w-4 h-4" /> [ FULL DB BACKUP / RESTORE ]
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('csv')}
            className={`py-2 px-4 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition ${
              activeTab === 'csv'
                ? 'bg-[#fcee0a]/10 border-[#fcee0a] text-[#fcee0a] font-bold glow-yellow'
                : 'bg-[#131722] border-[#1e2538] text-slate-400 hover:border-slate-600'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" /> [ CSV IMPORT / EXPORT ]
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* TAB 1: FULL DATABASE BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              <div className="p-4 bg-[#131722] border border-[#1e2538] space-y-2">
                <h4 className="text-xs font-bold font-mono uppercase text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-[#00f0ff]" /> Full Database Snapshot Export
                </h4>
                <p className="text-xs text-slate-400">
                  Exports complete normalized relational records: all examinations, subjects, canonical topics, syllabus tree coordinates, preparation records, revision histories, and activity history.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleExportFullDatabase}
                    disabled={isExportingDb}
                    className="px-4 py-2 bg-[#00f0ff] hover:bg-cyan-300 text-black font-bold font-mono text-xs uppercase flex items-center gap-2 glow-cyan"
                  >
                    <Download className="w-4 h-4" />
                    {isExportingDb ? 'PACKING SNAPSHOT...' : '[ DOWNLOAD FULL BACKUP (JSON) ]'}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-[#131722] border border-[#1e2538] space-y-2">
                <h4 className="text-xs font-bold font-mono uppercase text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#fcee0a]" /> Full Database Snapshot Restore
                </h4>
                <p className="text-xs text-slate-400">
                  Restores the system from a previously exported JSON backup file, preserving all IDs, relationships, and foreign keys.
                </p>

                {restoreStatus && (
                  <div className={`p-2.5 text-xs font-mono border ${
                    restoreStatus.startsWith('SUCCESS')
                      ? 'bg-green-950/40 border-green-500 text-green-300'
                      : 'bg-red-950/40 border-red-500 text-red-300'
                  }`}>
                    {restoreStatus}
                  </div>
                )}

                <div className="pt-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#fcee0a] hover:bg-yellow-300 text-black font-bold font-mono text-xs uppercase cursor-pointer glow-yellow">
                    <Upload className="w-4 h-4" />
                    {isRestoringDb ? 'REBUILDING DATABASE...' : '[ SELECT BACKUP FILE TO RESTORE ]'}
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleRestoreFullDatabase}
                      disabled={isRestoringDb}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CSV IMPORT & EXPORT */}
          {activeTab === 'csv' && (
            <div className="space-y-6">
              {/* CSV Export */}
              <div className="p-4 bg-[#131722] border border-[#1e2538] space-y-2">
                <h4 className="text-xs font-bold font-mono uppercase text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-[#00f0ff]" /> CSV Export
                </h4>
                <p className="text-xs text-slate-400">
                  Exports canonical topics with syllabus positions, difficulty, priority, general notes, and exam preparation.
                </p>
                <div className="pt-1">
                  <a
                    href={api.getCsvExportUrl(activeExamId)}
                    download
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#00f0ff] hover:bg-cyan-300 text-black font-bold font-mono text-xs uppercase glow-cyan"
                  >
                    <Download className="w-4 h-4" /> [ EXPORT CURRENT SYLLABUS CSV ]
                  </a>
                </div>
              </div>

              {/* CSV Import */}
              <div className="p-4 bg-[#131722] border border-[#1e2538] space-y-3">
                <h4 className="text-xs font-bold font-mono uppercase text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#fcee0a]" /> CSV Import & Duplicate Preview
                </h4>
                <p className="text-xs text-slate-400">
                  Upload a CSV file. The system will inspect rows, detect potential duplicates in the Knowledge Vault, and allow you to review before committing.
                </p>

                {csvMessage && (
                  <div className="p-2.5 bg-black/60 border border-[#00f0ff] text-xs font-mono text-cyan-300">
                    {csvMessage}
                  </div>
                )}

                <div>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs uppercase cursor-pointer border border-slate-600">
                    <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                    {isPreviewing ? 'PARSING CSV...' : '[ CHOOSE CSV FILE ]'}
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvSelect}
                      disabled={isPreviewing}
                      className="hidden"
                    />
                  </label>
                  {csvFile && (
                    <span className="ml-3 text-xs font-mono text-slate-400">{csvFile.name}</span>
                  )}
                </div>

                {/* CSV Preview Table */}
                {preview && (
                  <div className="space-y-3 pt-3 border-t border-[#1e2538]">
                    <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                      <div className="p-2 bg-black/40 border border-[#1e2538]">
                        <span className="text-slate-500 block text-[10px]">NEW TOPICS:</span>
                        <span className="font-bold text-cyan-400">{preview.new_topics_count}</span>
                      </div>
                      <div className="p-2 bg-black/40 border border-[#1e2538]">
                        <span className="text-slate-500 block text-[10px]">EXISTING LINKS:</span>
                        <span className="font-bold text-green-400">{preview.existing_links_count}</span>
                      </div>
                      <div className="p-2 bg-black/40 border border-[#1e2538]">
                        <span className="text-slate-500 block text-[10px]">POTENTIAL DUPLICATES:</span>
                        <span className="font-bold text-yellow-400">{preview.potential_duplicates_count}</span>
                      </div>
                    </div>

                    <div className="max-h-52 overflow-y-auto border border-[#1e2538]">
                      <table className="w-full text-left text-[11px] font-mono">
                        <thead className="bg-[#131722] text-slate-400 border-b border-[#1e2538]">
                          <tr>
                            <th className="p-2">Row</th>
                            <th className="p-2">Topic Title</th>
                            <th className="p-2">Action</th>
                            <th className="p-2">Match Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1e2538]">
                          {preview.rows.map((r) => (
                            <tr key={r.row_number} className="hover:bg-slate-900/50">
                              <td className="p-2 text-slate-500">#{r.row_number}</td>
                              <td className="p-2 font-bold text-white">{r.title}</td>
                              <td className="p-2">
                                <span
                                  className={`px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                    r.action === 'create_new'
                                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                      : r.action === 'link_existing'
                                      ? 'bg-green-950 text-green-300 border border-green-800'
                                      : 'bg-yellow-950 text-yellow-300 border border-yellow-800'
                                  }`}
                                >
                                  {r.action.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="p-2 text-slate-400">
                                {r.matched_existing_title
                                  ? `Matched: "${r.matched_existing_title}"`
                                  : 'New canonical record'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={handleCommitCsv}
                        disabled={isCommitting}
                        className="px-5 py-2 bg-[#fcee0a] hover:bg-yellow-300 text-black font-bold font-mono text-xs uppercase glow-yellow"
                      >
                        {isCommitting ? 'COMMITTING IMPORT...' : '[ CONFIRM & COMMIT IMPORT ]'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
