from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import (
    Examination, Subject, KnowledgeTopic, ExamSyllabusNode,
    TopicPreparation, ExamSubject, ActivityHistory, SubjectTopic
)
from app.schemas import DashboardStats, ActivityHistoryResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(exam_id: Optional[str] = None, db: Session = Depends(get_db)):
    # Global counts
    total_exams = db.query(Examination).count()
    total_subjects = db.query(Subject).count()
    total_canonical = db.query(KnowledgeTopic).count()
    total_nodes = db.query(ExamSyllabusNode).count()

    # Determine active exam
    active_exam = None
    if exam_id:
        active_exam = db.query(Examination).filter(Examination.id == exam_id).first()
    if not active_exam:
        active_exam = db.query(Examination).order_by(Examination.created_at.desc()).first()

    active_exam_id = active_exam.id if active_exam else None
    active_exam_name = active_exam.name if active_exam else None

    # Exam-specific stats
    active_total_topics = 0
    completed_topics = 0
    learning_topics = 0
    reviewing_topics = 0
    not_started_topics = 0
    needs_revision_topics = 0
    prog_pct = 0.0
    subject_progress = []
    upcoming_revisions = []

    now = datetime.now(timezone.utc)

    if active_exam:
        # All topic-bearing nodes in active exam
        exam_nodes = db.query(ExamSyllabusNode).filter(
            ExamSyllabusNode.exam_id == active_exam.id,
            ExamSyllabusNode.topic_id.isnot(None)
        ).all()
        
        # Distinct topic IDs in this exam
        distinct_topic_ids = list({node.topic_id for node in exam_nodes})
        active_total_topics = len(distinct_topic_ids)

        if active_total_topics > 0:
            preps = db.query(TopicPreparation).filter(
                TopicPreparation.exam_id == active_exam.id,
                TopicPreparation.topic_id.in_(distinct_topic_ids)
            ).all()
            
            prep_map = {p.topic_id: p for p in preps}
            
            for tid in distinct_topic_ids:
                prep = prep_map.get(tid)
                st = prep.status if prep else "not_started"
                if st == "completed":
                    completed_topics += 1
                elif st == "learning":
                    learning_topics += 1
                elif st == "reviewing":
                    reviewing_topics += 1
                else:
                    not_started_topics += 1

                # Check if revision is due
                if prep and prep.next_revision_at:
                    # Make aware comparison
                    next_rev = prep.next_revision_at
                    if next_rev.tzinfo is None:
                        next_rev = next_rev.replace(tzinfo=timezone.utc)
                    if next_rev <= now:
                        needs_revision_topics += 1

            prog_pct = round((completed_topics / active_total_topics * 100), 1)

        # Subject-wise progress for active exam
        exam_subjects = db.query(ExamSubject).filter(ExamSubject.exam_id == active_exam.id).all()
        for es in exam_subjects:
            sub = db.query(Subject).filter(Subject.id == es.subject_id).first()
            if not sub:
                continue
            
            # Nodes under this subject
            sub_nodes = db.query(ExamSyllabusNode).filter(
                ExamSyllabusNode.exam_id == active_exam.id,
                ExamSyllabusNode.exam_subject_id == es.id,
                ExamSyllabusNode.topic_id.isnot(None)
            ).all()
            sub_topic_ids = list({n.topic_id for n in sub_nodes})
            sub_total = len(sub_topic_ids)
            
            sub_completed = 0
            if sub_total > 0:
                sub_completed = db.query(TopicPreparation).filter(
                    TopicPreparation.exam_id == active_exam.id,
                    TopicPreparation.topic_id.in_(sub_topic_ids),
                    TopicPreparation.status == "completed"
                ).count()
                
            sub_pct = round((sub_completed / sub_total * 100), 1) if sub_total > 0 else 0.0
            subject_progress.append({
                "subject_id": sub.id,
                "subject_name": sub.name,
                "total_topics": sub_total,
                "completed_topics": sub_completed,
                "progress_percentage": sub_pct
            })

        # Upcoming revisions queue (due or upcoming in active exam)
        active_preps = db.query(TopicPreparation).filter(
            TopicPreparation.exam_id == active_exam.id,
            TopicPreparation.next_revision_at.isnot(None)
        ).order_by(TopicPreparation.next_revision_at.asc()).limit(10).all()

        for p in active_preps:
            t = db.query(KnowledgeTopic).filter(KnowledgeTopic.id == p.topic_id).first()
            next_rev = p.next_revision_at
            if next_rev.tzinfo is None:
                next_rev = next_rev.replace(tzinfo=timezone.utc)
            is_overdue = next_rev <= now
            upcoming_revisions.append({
                "topic_id": p.topic_id,
                "topic_title": t.title if t else "Unknown",
                "status": p.status,
                "confidence_score": p.confidence_score,
                "revision_count": p.revision_count,
                "next_revision_at": p.next_revision_at.isoformat(),
                "is_overdue": is_overdue
            })

    # Recent activities (last 15)
    activities = db.query(ActivityHistory).order_by(ActivityHistory.created_at.desc()).limit(15).all()
    recent_acts = [ActivityHistoryResponse.model_validate(a) for a in activities]

    formula_str = (
        "Progress % = (Completed Topics in Exam Syllabus / Total Distinct Topics in Exam Syllabus) * 100. "
        "Canonical topics are deduplicated so shared topics count as exactly one unit of progress within this syllabus."
    )

    return DashboardStats(
        total_examinations=total_exams,
        total_subjects=total_subjects,
        total_canonical_topics=total_canonical,
        total_exam_syllabus_nodes=total_nodes,
        active_exam_id=active_exam_id,
        active_exam_name=active_exam_name,
        active_exam_total_topics=active_total_topics,
        active_exam_completed_topics=completed_topics,
        active_exam_learning_topics=learning_topics,
        active_exam_reviewing_topics=reviewing_topics,
        active_exam_not_started_topics=not_started_topics,
        active_exam_needs_revision_topics=needs_revision_topics,
        active_exam_progress_percent=prog_pct,
        progress_calculation_formula=formula_str,
        subject_progress=subject_progress,
        upcoming_revisions=upcoming_revisions,
        recent_activities=recent_acts
    )
