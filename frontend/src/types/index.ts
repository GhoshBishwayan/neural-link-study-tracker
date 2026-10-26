export type PreparationStatus = 'not_started' | 'learning' | 'reviewing' | 'completed';

export interface Examination {
  id: string;
  name: string;
  description?: string | null;
  exam_date?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  subject_count?: number;
  topic_count?: number;
  completed_topic_count?: number;
  progress_percentage?: number;
}

export interface Subject {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
  topic_count?: number;
  exam_count?: number;
}

export interface ExamSubject {
  id: string;
  exam_id: string;
  subject_id: string;
  syllabus_description?: string | null;
  display_order: number;
  subject_name?: string;
}

export interface KnowledgeTopic {
  id: string;
  title: string;
  description?: string | null;
  general_notes: string;
  difficulty: number;
  priority: number;
  estimated_minutes: number;
  created_at: string;
  updated_at: string;
  usage_count?: number;
}

export interface RevisionHistory {
  id: string;
  topic_preparation_id: string;
  revised_at: string;
  revision_notes: string;
  confidence_before: number;
  confidence_after: number;
}

export interface TopicPreparation {
  id: string;
  exam_id: string;
  topic_id: string;
  status: PreparationStatus;
  confidence_score: number;
  revision_count: number;
  last_revised_at?: string | null;
  next_revision_at?: string | null;
  personal_notes: string;
  actual_study_minutes: number;
  created_at: string;
  updated_at: string;
  revisions?: RevisionHistory[];
}

export interface SyllabusNode {
  id: string;
  exam_id: string;
  exam_subject_id?: string | null;
  topic_id?: string | null;
  parent_node_id?: string | null;
  title: string;
  display_order: number;
  position_x: number;
  position_y: number;
  is_required: boolean;
  syllabus_notes?: string | null;
  is_organizational: boolean;
  topic?: KnowledgeTopic | null;
  preparation?: TopicPreparation | null;
  prerequisite_topic_ids?: string[];
}

export interface TopicUsageExamItem {
  exam_id: string;
  exam_name: string;
  syllabus_node_id?: string | null;
  syllabus_title?: string | null;
  preparation_status: PreparationStatus;
  confidence_score: number;
  revision_count: number;
  last_revised_at?: string | null;
}

export interface TopicUsageResponse {
  topic_id: string;
  title: string;
  used_in_exams: TopicUsageExamItem[];
}

export interface DuplicateMatch {
  id: string;
  title: string;
  similarity_score: number;
  description?: string | null;
  subjects: string[];
  used_in_exams: string[];
}

export interface DuplicateCheckResponse {
  query: string;
  exact_match?: DuplicateMatch | null;
  similar_matches: DuplicateMatch[];
}

export interface ActivityHistoryItem {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id?: string | null;
  exam_id?: string | null;
  details?: string | null;
  created_at: string;
}

export interface DashboardStats {
  total_examinations: number;
  total_subjects: number;
  total_canonical_topics: number;
  total_exam_syllabus_nodes: number;
  active_exam_id?: string | null;
  active_exam_name?: string | null;
  active_exam_total_topics: number;
  active_exam_completed_topics: number;
  active_exam_learning_topics: number;
  active_exam_reviewing_topics: number;
  active_exam_not_started_topics: number;
  active_exam_needs_revision_topics: number;
  active_exam_progress_percent: number;
  progress_calculation_formula: string;
  subject_progress: Array<{
    subject_id: string;
    subject_name: string;
    total_topics: number;
    completed_topics: number;
    progress_percentage: number;
  }>;
  upcoming_revisions: Array<{
    topic_id: string;
    topic_title: string;
    status: string;
    confidence_score: number;
    revision_count: number;
    next_revision_at: string;
    is_overdue: boolean;
  }>;
  recent_activities: ActivityHistoryItem[];
}

export interface CSVImportPreviewRow {
  row_number: number;
  canonical_id?: string | null;
  title: string;
  subject_name?: string | null;
  exam_name?: string | null;
  syllabus_parent_title?: string | null;
  action: 'create_new' | 'link_existing' | 'duplicate_warning';
  matched_existing_topic_id?: string | null;
  matched_existing_title?: string | null;
  status?: string;
  confidence?: number;
  difficulty?: number;
  general_notes?: string;
  personal_notes?: string;
}

export interface CSVImportPreviewResponse {
  total_rows: number;
  new_topics_count: number;
  existing_links_count: number;
  potential_duplicates_count: number;
  rows: CSVImportPreviewRow[];
}

export interface CSVImportCommitRequest {
  exam_id?: string | null;
  rows: CSVImportPreviewRow[];
}
