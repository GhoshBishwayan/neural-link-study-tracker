import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { SkillTree } from './components/SkillTree';
import { ListView } from './components/ListView';
import { KnowledgeVault } from './components/KnowledgeVault';
import { Dashboard } from './components/Dashboard';
import { BackupModal } from './components/BackupModal';
import { TopicInspector } from './components/TopicInspector';
import { CreateOrLinkModal } from './components/CreateOrLinkModal';
import { RevisionModal } from './components/RevisionModal';
import { Examination, ExamSubject, SyllabusNode } from './types';
import { api } from './api/client';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [activeExam, setActiveExam] = useState<Examination | null>(null);
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>([]);
  const [syllabusNodes, setSyllabusNodes] = useState<SyllabusNode[]>([]);
  const [activeTab, setActiveTab] = useState<'tree' | 'list' | 'vault' | 'dashboard' | 'backup'>('tree');

  // Selected node for inspector
  const [selectedNode, setSelectedNode] = useState<SyllabusNode | null>(null);

  // Create or link modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalParentId, setCreateModalParentId] = useState<string | null>(null);
  const [createModalPos, setCreateModalPos] = useState<{ x: number; y: number }>({ x: 200, y: 200 });

  // Quick revision modal from Dashboard
  const [quickReviseTopic, setQuickReviseTopic] = useState<{ id: string; title: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);

  // 1. Fetch Examinations
  const fetchExaminations = useCallback(async () => {
    try {
      setBackendError(null);
      const data = await api.getExaminations();
      setExaminations(data);
      if (data.length > 0) {
        setActiveExam((prev) => {
          if (prev) {
            const found = data.find((e) => e.id === prev.id);
            return found || data[0];
          }
          return data[0];
        });
      }
    } catch (err: any) {
      setBackendError(err.message || 'Cannot connect to NEURO//TREE Backend on http://127.0.0.1:8000');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExaminations();
  }, [fetchExaminations]);

  // 2. Fetch Syllabus and Subjects when activeExam changes
  const fetchExamData = useCallback(async () => {
    if (!activeExam) return;
    try {
      const [subjects, nodes] = await Promise.all([
        api.getExamSubjects(activeExam.id),
        api.getExamSyllabus(activeExam.id)
      ]);
      setExamSubjects(subjects);
      setSyllabusNodes(nodes);

      // Keep selected node updated if open
      if (selectedNode) {
        const refreshedNode = nodes.find((n) => n.id === selectedNode.id);
        if (refreshedNode) setSelectedNode(refreshedNode);
      }
    } catch (err) {
      console.error('Failed to load exam data:', err);
    }
  }, [activeExam, selectedNode?.id]);

  useEffect(() => {
    fetchExamData();
  }, [activeExam?.id]);

  const handleOpenCreateModal = (parentNodeId?: string | null, x?: number, y?: number) => {
    setCreateModalParentId(parentNodeId || null);
    setCreateModalPos({ x: x || 240, y: y || 200 });
    setIsCreateModalOpen(true);
  };

  const handleSwitchExamById = (examId: string) => {
    const found = examinations.find((e) => e.id === examId);
    if (found) {
      setActiveExam(found);
      setSelectedNode(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080c] text-slate-100 flex flex-col font-sans">
      {/* Top Cyberpunk Navbar */}
      <Navbar
        examinations={examinations}
        activeExam={activeExam}
        activeTab={activeTab}
        onSelectExam={(e) => {
          setActiveExam(e);
          setSelectedNode(null);
        }}
        onSelectTab={setActiveTab}
        onRefreshExams={fetchExaminations}
      />

      {/* Backend Error Banner if offline */}
      {backendError && (
        <div className="bg-red-950/80 border-b border-red-500 p-3 text-xs text-red-200 flex items-center justify-between px-6 font-mono">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>NEURAL LINK INTERRUPTED: {backendError}</span>
          </div>
          <button
            onClick={fetchExaminations}
            className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-bold uppercase text-[10px] flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> RETRY LINK
          </button>
        </div>
      )}

      {/* Main Content Area based on Active Tab */}
      <main className="flex-1 overflow-hidden relative">
        {loading ? (
          <div className="flex items-center justify-center h-full text-xs font-mono text-cyan-400">
            CONNECTING TO NEURO//TREE KNOWLEDGE MATRIX...
          </div>
        ) : (
          <>
            {activeTab === 'tree' && activeExam && (
              <SkillTree
                nodes={syllabusNodes}
                examId={activeExam.id}
                examName={activeExam.name}
                examSubjects={examSubjects}
                onSelectNode={(node) => setSelectedNode(node)}
                onOpenCreateModal={handleOpenCreateModal}
                onRefresh={() => {
                  fetchExamData();
                  fetchExaminations();
                }}
              />
            )}

            {activeTab === 'list' && activeExam && (
              <ListView
                nodes={syllabusNodes}
                examId={activeExam.id}
                examName={activeExam.name}
                examSubjects={examSubjects}
                onSelectNode={(node) => setSelectedNode(node)}
                onOpenCreateModal={handleOpenCreateModal}
                onRefresh={() => {
                  fetchExamData();
                  fetchExaminations();
                }}
              />
            )}

            {activeTab === 'vault' && <KnowledgeVault />}

            {activeTab === 'dashboard' && (
              <Dashboard
                activeExamId={activeExam?.id}
                onQuickRevise={(topicId, title) => {
                  setQuickReviseTopic({ id: topicId, title });
                }}
              />
            )}

            {activeTab === 'backup' && (
              <div className="p-8">
                <BackupModal
                  isOpen={true}
                  onClose={() => setActiveTab('tree')}
                  activeExamId={activeExam?.id}
                  onRefresh={() => {
                    fetchExamData();
                    fetchExaminations();
                  }}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Slide-over Topic Inspector Drawer */}
      {selectedNode && activeExam && (
        <TopicInspector
          node={selectedNode}
          activeExamId={activeExam.id}
          activeExamName={activeExam.name}
          onClose={() => setSelectedNode(null)}
          onRefresh={() => {
            fetchExamData();
            fetchExaminations();
          }}
          onSwitchExam={handleSwitchExamById}
        />
      )}

      {/* Create or Link Topic Modal */}
      {activeExam && (
        <CreateOrLinkModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          examId={activeExam.id}
          examSubjects={examSubjects}
          parentNodeId={createModalParentId}
          positionX={createModalPos.x}
          positionY={createModalPos.y}
          onSuccess={() => {
            fetchExamData();
            fetchExaminations();
          }}
        />
      )}

      {/* Quick Revise Modal from Dashboard */}
      {quickReviseTopic && activeExam && (
        <RevisionModal
          isOpen={true}
          onClose={() => setQuickReviseTopic(null)}
          examId={activeExam.id}
          examName={activeExam.name}
          topicId={quickReviseTopic.id}
          topicTitle={quickReviseTopic.title}
          currentConfidence={3}
          onSuccess={() => {
            fetchExamData();
            fetchExaminations();
          }}
        />
      )}
    </div>
  );
};

export default App;
