from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

# Base & Shared
class OrmModel(BaseModel):
    model_config = {"from_attributes": True}

# Activity History
class ActivityHistoryResponse(OrmModel):
    id: str
    action_type: str
    entity_type: str
    entity_id: Optional[str] = None
    exam_id: Optional[str] = None
    details: Optional[str] = None
    created_at: datetime

# Prerequisites
class PrerequisiteCreate(BaseModel):
    prerequisite_topic_id: str

class PrerequisiteInfo(OrmModel):
    id: str
    topic_id: str
    prerequisite_topic_id: str
    prerequisite_title: Optional[str] = None

# Revision History
class RevisionCreate(BaseModel):
    revision_notes: Optional[str] = ""
    confidence_before: int = Field(ge=1, le=5)
    confidence_after: int = Field(ge=1, le=5)
    spaced_interval_days: Optional[int] = None
    also_revise_exam_ids: Optional[List[str]] = []

class RevisionResponse(OrmModel):
    id: str
    topic_preparation_id: str
    revised_at: datetime
    revision_notes: str
    confidence_before: int
    confidence_after: int

# Topic Preparation
class TopicPreparationUpdate(BaseModel):
    status: Optional[str] = None # not_started, learning, reviewing, completed
    confidence_score: Optional[int] = Field(None, ge=1, le=5)
    personal_notes: Optional[str] = None
    actual_study_minutes: Optional[int] = None
    next_revision_at: Optional[datetime] = None

class TopicPreparationResponse(OrmModel):
    id: str
    exam_id: str
    topic_id: str
    status: str
    confidence_score: int
    revision_count: int
    last_revised_at: Optional[datetime] = None
    next_revision_at: Optional[datetime] = None
    personal_notes: str
    actual_study_minutes: int
    created_at: datetime
    updated_at: datetime
    revisions: Optional[List[RevisionResponse]] = []

# Knowledge Topic
class KnowledgeTopicCreate(BaseModel):
    title: str
    description: Optional[str] = None
    general_notes: Optional[str] = ""
    difficulty: int = Field(1, ge=1, le=5)
    priority: int = Field(1, ge=1, le=5)
    estimated_minutes: int = Field(60, ge=1)
    prerequisite_ids: Optional[List[str]] = []

class KnowledgeTopicUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    general_notes: Optional[str] = None
    difficulty: Optional[int] = Field(None, ge=1, le=5)
    priority: Optional[int] = Field(None, ge=1, le=5)
    estimated_minutes: Optional[int] = None

class TopicUsageExamItem(BaseModel):
    exam_id: str
    exam_name: str
    syllabus_node_id: Optional[str] = None
    syllabus_title: Optional[str] = None
    preparation_status: str
    confidence_score: int
    revision_count: int
    last_revised_at: Optional[datetime] = None

class TopicUsageResponse(BaseModel):
    topic_id: str
    title: str
    used_in_exams: List[TopicUsageExamItem]

class KnowledgeTopicResponse(OrmModel):
    id: str
    title: str
    description: Optional[str] = None
    general_notes: str
    difficulty: int
    priority: int
    estimated_minutes: int
    created_at: datetime
    updated_at: datetime
    usage_count: Optional[int] = 0

class DuplicateCheckMatch(BaseModel):
    id: str
    title: str
    similarity_score: float
    description: Optional[str] = None
    subjects: List[str] = []
    used_in_exams: List[str] = []

class DuplicateCheckResponse(BaseModel):
    query: str
    exact_match: Optional[DuplicateCheckMatch] = None
    similar_matches: List[DuplicateCheckMatch] = []

# Subject
class SubjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class SubjectResponse(OrmModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    topic_count: Optional[int] = 0
    exam_count: Optional[int] = 0

# Exam Subject
class ExamSubjectCreate(BaseModel):
    subject_id: str
    syllabus_description: Optional[str] = None
    display_order: Optional[int] = 0

class ExamSubjectResponse(OrmModel):
    id: str
    exam_id: str
    subject_id: str
    syllabus_description: Optional[str] = None
    display_order: int
    subject_name: Optional[str] = None

# Examination
class ExaminationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    exam_date: Optional[str] = None
    status: Optional[str] = "active"

class ExaminationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    exam_date: Optional[str] = None
    status: Optional[str] = None

class ExaminationResponse(OrmModel):
    id: str
    name: str
    description: Optional[str] = None
    exam_date: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    subject_count: Optional[int] = 0
    topic_count: Optional[int] = 0
    completed_topic_count: Optional[int] = 0
    progress_percentage: Optional[float] = 0.0

# Exam Syllabus Node
class SyllabusNodeCreate(BaseModel):
    exam_subject_id: Optional[str] = None
    topic_id: Optional[str] = None
    parent_node_id: Optional[str] = None
    title: Optional[str] = None
    display_order: Optional[int] = 0
    position_x: Optional[float] = 0.0
    position_y: Optional[float] = 0.0
    is_required: Optional[bool] = True
    syllabus_notes: Optional[str] = None
    is_organizational: Optional[bool] = False

class SyllabusNodeUpdate(BaseModel):
    title: Optional[str] = None
    parent_node_id: Optional[str] = None
    display_order: Optional[int] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    is_required: Optional[bool] = None
    syllabus_notes: Optional[str] = None

class NodePositionUpdate(BaseModel):
    id: str
    position_x: float
    position_y: float

class BatchPositionUpdateRequest(BaseModel):
    positions: List[NodePositionUpdate]

class SyllabusNodeResponse(OrmModel):
    id: str
    exam_id: str
    exam_subject_id: Optional[str] = None
    topic_id: Optional[str] = None
    parent_node_id: Optional[str] = None
    title: Optional[str] = None
    display_order: int
    position_x: float
    position_y: float
    is_required: bool
    syllabus_notes: Optional[str] = None
    is_organizational: bool
    # Joined data
    topic: Optional[KnowledgeTopicResponse] = None
    preparation: Optional[TopicPreparationResponse] = None
    prerequisite_topic_ids: Optional[List[str]] = []

# Unified Creation Request (Create new topic & link to syllabus)
class CreateTopicAndSyllabusNodeRequest(BaseModel):
    topic: KnowledgeTopicCreate
    exam_subject_id: Optional[str] = None
    parent_node_id: Optional[str] = None
    position_x: Optional[float] = 0.0
    position_y: Optional[float] = 0.0
    is_required: Optional[bool] = True

# Dashboard Stats
class DashboardStats(BaseModel):
    total_examinations: int
    total_subjects: int
    total_canonical_topics: int
    total_exam_syllabus_nodes: int
    active_exam_id: Optional[str] = None
    active_exam_name: Optional[str] = None
    active_exam_total_topics: int
    active_exam_completed_topics: int
    active_exam_learning_topics: int
    active_exam_reviewing_topics: int
    active_exam_not_started_topics: int
    active_exam_needs_revision_topics: int
    active_exam_progress_percent: float
    progress_calculation_formula: str
    subject_progress: List[Dict[str, Any]]
    upcoming_revisions: List[Dict[str, Any]]
    recent_activities: List[ActivityHistoryResponse]

# CSV Import / Export & Backup
class CSVImportPreviewRow(BaseModel):
    row_number: int
    canonical_id: Optional[str] = None
    title: str
    subject_name: Optional[str] = None
    exam_name: Optional[str] = None
    syllabus_parent_title: Optional[str] = None
    action: str # "create_new", "link_existing", "duplicate_warning"
    matched_existing_topic_id: Optional[str] = None
    matched_existing_title: Optional[str] = None
    status: Optional[str] = "not_started"
    confidence: Optional[int] = 1
    difficulty: Optional[int] = 1
    general_notes: Optional[str] = ""
    personal_notes: Optional[str] = ""

class CSVImportPreviewResponse(BaseModel):
    total_rows: int
    new_topics_count: int
    existing_links_count: int
    potential_duplicates_count: int
    rows: List[CSVImportPreviewRow]

class CSVImportCommitRequest(BaseModel):
    exam_id: Optional[str] = None
    rows: List[CSVImportPreviewRow]

class FullDatabaseBackup(BaseModel):
    version: str = "1.0"
    exported_at: str
    examinations: List[Dict[str, Any]]
    subjects: List[Dict[str, Any]]
    exam_subjects: List[Dict[str, Any]]
    knowledge_topics: List[Dict[str, Any]]
    subject_topics: List[Dict[str, Any]]
    exam_syllabus_nodes: List[Dict[str, Any]]
    topic_preparations: List[Dict[str, Any]]
    revision_histories: List[Dict[str, Any]]
    topic_prerequisites: List[Dict[str, Any]]
    activity_histories: List[Dict[str, Any]]
