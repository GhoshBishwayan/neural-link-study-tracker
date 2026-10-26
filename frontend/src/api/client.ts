import {
  Examination, Subject, ExamSubject, KnowledgeTopic, SyllabusNode,
  TopicPreparation, RevisionHistory, TopicUsageResponse, DuplicateCheckResponse,
  DashboardStats, CSVImportPreviewResponse, CSVImportCommitRequest
} from '../types';

const API_BASE = 'http://127.0.0.1:8000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    }
  });

  if (!res.ok) {
    let errorDetail = 'API Request failed';
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || JSON.stringify(errJson);
    } catch {
      errorDetail = await res.text();
    }
    throw new Error(errorDetail);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

export const api = {
  // Examinations
  getExaminations: () => request<Examination[]>('/examinations'),
  createExamination: (data: Partial<Examination>) => request<Examination>('/examinations', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateExamination: (id: string, data: Partial<Examination>) => request<Examination>(`/examinations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteExamination: (id: string) => request<void>(`/examinations/${id}`, {
    method: 'DELETE'
  }),
  getExamSubjects: (examId: string) => request<ExamSubject[]>(`/examinations/${examId}/subjects`),
  associateExamSubject: (examId: string, data: { subject_id: string; syllabus_description?: string; display_order?: number }) =>
    request<ExamSubject>(`/examinations/${examId}/subjects`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  removeExamSubject: (examId: string, subjectId: string) =>
    request<void>(`/examinations/${examId}/subjects/${subjectId}`, {
      method: 'DELETE'
    }),

  // Subjects
  getSubjects: () => request<Subject[]>('/subjects'),
  createSubject: (data: Partial<Subject>) => request<Subject>('/subjects', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateSubject: (id: string, data: Partial<Subject>) => request<Subject>(`/subjects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteSubject: (id: string) => request<void>(`/subjects/${id}`, {
    method: 'DELETE'
  }),
  getSubjectTopics: (subjectId: string) => request<KnowledgeTopic[]>(`/subjects/${subjectId}/topics`),

  // Canonical Topics
  getTopics: (q?: string) => request<KnowledgeTopic[]>(`/topics${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createTopic: (data: Partial<KnowledgeTopic> & { prerequisite_ids?: string[] }) => request<KnowledgeTopic>('/topics', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getTopic: (id: string) => request<KnowledgeTopic>(`/topics/${id}`),
  updateTopic: (id: string, data: Partial<KnowledgeTopic>) => request<KnowledgeTopic>(`/topics/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteTopic: (id: string, force: boolean = false) => request<{ message: string }>(`/topics/${id}?force=${force}`, {
    method: 'DELETE'
  }),
  checkDuplicate: (title: string) => request<DuplicateCheckResponse>(`/topics/check-duplicate?title=${encodeURIComponent(title)}`),
  getTopicUsage: (topicId: string) => request<TopicUsageResponse>(`/topics/${topicId}/usage`),
  getPrerequisites: (topicId: string) => request<Array<{ id: string; topic_id: string; prerequisite_topic_id: string; prerequisite_title?: string }>>(`/topics/${topicId}/prerequisites`),
  addPrerequisite: (topicId: string, prerequisite_topic_id: string) => request<any>(`/topics/${topicId}/prerequisites`, {
    method: 'POST',
    body: JSON.stringify({ prerequisite_topic_id })
  }),
  removePrerequisite: (topicId: string, prerequisite_topic_id: string) => request<void>(`/topics/${topicId}/prerequisites/${prerequisite_topic_id}`, {
    method: 'DELETE'
  }),

  // Syllabus
  getExamSyllabus: (examId: string) => request<SyllabusNode[]>(`/examinations/${examId}/syllabus`),
  addSyllabusNode: (examId: string, data: Partial<SyllabusNode>) => request<SyllabusNode>(`/examinations/${examId}/syllabus/nodes`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  createAndLinkTopic: (examId: string, payload: any) => request<SyllabusNode>(`/examinations/${examId}/syllabus/create-and-link`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  updateNodePositions: (examId: string, positions: Array<{ id: string; position_x: number; position_y: number }>) =>
    request<{ message: string }>(`/examinations/${examId}/syllabus/positions`, {
      method: 'PATCH',
      body: JSON.stringify({ positions })
    }),
  updateSyllabusNode: (examId: string, nodeId: string, data: Partial<SyllabusNode>) =>
    request<SyllabusNode>(`/examinations/${examId}/syllabus/nodes/${nodeId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteSyllabusNode: (examId: string, nodeId: string) =>
    request<void>(`/examinations/${examId}/syllabus/nodes/${nodeId}`, {
      method: 'DELETE'
    }),

  // Preparation
  getPreparation: (examId: string, topicId: string) => request<TopicPreparation>(`/examinations/${examId}/topics/${topicId}/preparation`),
  updatePreparation: (examId: string, topicId: string, data: Partial<TopicPreparation>) =>
    request<TopicPreparation>(`/examinations/${examId}/topics/${topicId}/preparation`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  // Revisions
  getRevisions: (examId: string, topicId: string) => request<RevisionHistory[]>(`/examinations/${examId}/topics/${topicId}/revisions`),
  recordRevision: (examId: string, topicId: string, data: {
    revision_notes?: string;
    confidence_before: number;
    confidence_after: number;
    spaced_interval_days?: number;
    also_revise_exam_ids?: string[];
  }) => request<TopicPreparation>(`/examinations/${examId}/topics/${topicId}/revisions`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Dashboard
  getDashboardStats: (examId?: string) => request<DashboardStats>(`/dashboard/stats${examId ? `?exam_id=${examId}` : ''}`),

  // Backup & CSV
  getCsvExportUrl: (examId?: string) => `${API_BASE}/backup/export-csv${examId ? `?exam_id=${examId}` : ''}`,
  previewCsv: async (file: File): Promise<CSVImportPreviewResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/backup/csv-preview`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  commitCsv: (payload: CSVImportCommitRequest) => request<{ message: string }>('/backup/csv-commit', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  exportFullDatabase: () => request<any>('/backup/export-full'),
  restoreFullDatabase: (backupData: any) => request<{ message: string }>('/backup/restore-full', {
    method: 'POST',
    body: JSON.stringify(backupData)
  })
};
