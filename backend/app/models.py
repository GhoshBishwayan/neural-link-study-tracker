import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base

def gen_uuid():
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)

class Examination(Base):
    __tablename__ = "examinations"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    exam_date = Column(String(50), nullable=True)
    status = Column(String(50), default="active")
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    exam_subjects = relationship("ExamSubject", back_populates="examination", cascade="all, delete-orphan")
    syllabus_nodes = relationship("ExamSyllabusNode", back_populates="examination", cascade="all, delete-orphan")
    preparations = relationship("TopicPreparation", back_populates="examination", cascade="all, delete-orphan")
    activities = relationship("ActivityHistory", back_populates="examination")


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    exam_subjects = relationship("ExamSubject", back_populates="subject", cascade="all, delete-orphan")
    subject_topics = relationship("SubjectTopic", back_populates="subject", cascade="all, delete-orphan")


class ExamSubject(Base):
    __tablename__ = "exam_subjects"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    exam_id = Column(String(36), ForeignKey("examinations.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(String(36), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    syllabus_description = Column(Text, nullable=True)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=utc_now)

    __table_args__ = (
        UniqueConstraint("exam_id", "subject_id", name="uq_exam_subject"),
    )

    examination = relationship("Examination", back_populates="exam_subjects")
    subject = relationship("Subject", back_populates="exam_subjects")
    syllabus_nodes = relationship("ExamSyllabusNode", back_populates="exam_subject")


class KnowledgeTopic(Base):
    __tablename__ = "knowledge_topics"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    general_notes = Column(Text, default="")
    difficulty = Column(Integer, default=1)
    priority = Column(Integer, default=1)
    estimated_minutes = Column(Integer, default=60)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    subject_topics = relationship("SubjectTopic", back_populates="topic", cascade="all, delete-orphan")
    syllabus_nodes = relationship("ExamSyllabusNode", back_populates="topic")
    preparations = relationship("TopicPreparation", back_populates="topic", cascade="all, delete-orphan")
    prerequisites = relationship(
        "TopicPrerequisite",
        foreign_keys="TopicPrerequisite.topic_id",
        back_populates="topic",
        cascade="all, delete-orphan"
    )
    prerequisite_ofs = relationship(
        "TopicPrerequisite",
        foreign_keys="TopicPrerequisite.prerequisite_topic_id",
        back_populates="prerequisite_topic",
        cascade="all, delete-orphan"
    )


class SubjectTopic(Base):
    __tablename__ = "subject_topics"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    subject_id = Column(String(36), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    topic_id = Column(String(36), ForeignKey("knowledge_topics.id", ondelete="CASCADE"), nullable=False)
    parent_subject_topic_id = Column(String(36), ForeignKey("subject_topics.id", ondelete="SET NULL"), nullable=True)
    display_order = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("subject_id", "topic_id", name="uq_subject_topic"),
    )

    subject = relationship("Subject", back_populates="subject_topics")
    topic = relationship("KnowledgeTopic", back_populates="subject_topics")
    parent = relationship("SubjectTopic", remote_side=[id], backref="children")


class ExamSyllabusNode(Base):
    __tablename__ = "exam_syllabus_nodes"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    exam_id = Column(String(36), ForeignKey("examinations.id", ondelete="CASCADE"), nullable=False)
    exam_subject_id = Column(String(36), ForeignKey("exam_subjects.id", ondelete="SET NULL"), nullable=True)
    topic_id = Column(String(36), ForeignKey("knowledge_topics.id", ondelete="SET NULL"), nullable=True)
    parent_node_id = Column(String(36), ForeignKey("exam_syllabus_nodes.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=True)
    display_order = Column(Integer, default=0)
    position_x = Column(Float, default=0.0)
    position_y = Column(Float, default=0.0)
    is_required = Column(Boolean, default=True)
    syllabus_notes = Column(Text, nullable=True)
    is_organizational = Column(Boolean, default=False)

    examination = relationship("Examination", back_populates="syllabus_nodes")
    exam_subject = relationship("ExamSubject", back_populates="syllabus_nodes")
    topic = relationship("KnowledgeTopic", back_populates="syllabus_nodes")
    parent_node = relationship("ExamSyllabusNode", remote_side=[id], backref="child_nodes")


class TopicPreparation(Base):
    __tablename__ = "topic_preparation"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    exam_id = Column(String(36), ForeignKey("examinations.id", ondelete="CASCADE"), nullable=False)
    topic_id = Column(String(36), ForeignKey("knowledge_topics.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), default="not_started") # not_started, learning, reviewing, completed
    confidence_score = Column(Integer, default=1) # 1 to 5
    revision_count = Column(Integer, default=0)
    last_revised_at = Column(DateTime, nullable=True)
    next_revision_at = Column(DateTime, nullable=True)
    personal_notes = Column(Text, default="")
    actual_study_minutes = Column(Integer, default=0)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    __table_args__ = (
        UniqueConstraint("exam_id", "topic_id", name="uq_exam_topic_prep"),
    )

    examination = relationship("Examination", back_populates="preparations")
    topic = relationship("KnowledgeTopic", back_populates="preparations")
    revisions = relationship("RevisionHistory", back_populates="topic_preparation", cascade="all, delete-orphan", order_by="desc(RevisionHistory.revised_at)")


class RevisionHistory(Base):
    __tablename__ = "revision_history"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    topic_preparation_id = Column(String(36), ForeignKey("topic_preparation.id", ondelete="CASCADE"), nullable=False)
    revised_at = Column(DateTime, default=utc_now, nullable=False)
    revision_notes = Column(Text, default="")
    confidence_before = Column(Integer, default=1)
    confidence_after = Column(Integer, default=1)

    topic_preparation = relationship("TopicPreparation", back_populates="revisions")


class TopicPrerequisite(Base):
    __tablename__ = "topic_prerequisites"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    topic_id = Column(String(36), ForeignKey("knowledge_topics.id", ondelete="CASCADE"), nullable=False)
    prerequisite_topic_id = Column(String(36), ForeignKey("knowledge_topics.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (
        UniqueConstraint("topic_id", "prerequisite_topic_id", name="uq_topic_prerequisite"),
    )

    topic = relationship("KnowledgeTopic", foreign_keys=[topic_id], back_populates="prerequisites")
    prerequisite_topic = relationship("KnowledgeTopic", foreign_keys=[prerequisite_topic_id], back_populates="prerequisite_ofs")


class ActivityHistory(Base):
    __tablename__ = "activity_history"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    action_type = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(36), nullable=True)
    exam_id = Column(String(36), ForeignKey("examinations.id", ondelete="SET NULL"), nullable=True)
    details = Column(Text, default="")
    created_at = Column(DateTime, default=utc_now)

    examination = relationship("Examination", back_populates="activities")
