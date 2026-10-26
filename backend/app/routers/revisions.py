import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import TopicPreparation, KnowledgeTopic, Examination, RevisionHistory
from app.schemas import RevisionCreate, RevisionResponse, TopicPreparationResponse
from app.routers.common import log_activity, calculate_next_revision

router = APIRouter(prefix="/examinations/{exam_id}/topics/{topic_id}/revisions", tags=["revisions"])

def perform_revision(
    db: Session,
    exam_id: str,
    topic_id: str,
    revision_notes: str,
    confidence_before: int,
    confidence_after: int,
    spaced_interval_days: int = None
) -> RevisionHistory:
    prep = db.query(TopicPreparation).filter(
        TopicPreparation.exam_id == exam_id,
        TopicPreparation.topic_id == topic_id
    ).first()
    
    if not prep:
        prep = TopicPreparation(
            exam_id=exam_id,
            topic_id=topic_id,
            status="learning",
            confidence_score=confidence_after,
            revision_count=0
        )
        db.add(prep)
        db.commit()
        db.refresh(prep)

    # Increment revision count
    prep.revision_count += 1
    prep.confidence_score = confidence_after
    prep.last_revised_at = datetime.now(timezone.utc)
    prep.next_revision_at = calculate_next_revision(
        confidence_after,
        prep.revision_count,
        spaced_interval_days
    )
    prep.updated_at = datetime.now(timezone.utc)
    
    # If currently not started, move to learning or reviewing
    if prep.status == "not_started":
        prep.status = "learning"

    rev_history = RevisionHistory(
        id=str(uuid.uuid4()),
        topic_preparation_id=prep.id,
        revised_at=datetime.now(timezone.utc),
        revision_notes=revision_notes or "",
        confidence_before=confidence_before,
        confidence_after=confidence_after
    )
    db.add(rev_history)
    db.commit()
    db.refresh(rev_history)

    topic = db.query(KnowledgeTopic).filter(KnowledgeTopic.id == topic_id).first()
    title = topic.title if topic else topic_id
    exam = db.query(Examination).filter(Examination.id == exam_id).first()
    exam_name = exam.name if exam else exam_id

    log_activity(
        db,
        "topic_revised",
        "revision",
        rev_history.id,
        exam_id,
        f"Revised '{title}' for {exam_name} (Rev #{prep.revision_count}, Conf: {confidence_after}/5)"
    )
    db.commit()

    return rev_history

@router.get("", response_model=List[RevisionResponse])
def get_revision_history(exam_id: str, topic_id: str, db: Session = Depends(get_db)):
    prep = db.query(TopicPreparation).filter(
        TopicPreparation.exam_id == exam_id,
        TopicPreparation.topic_id == topic_id
    ).first()
    if not prep:
        return []
    
    revisions = db.query(RevisionHistory).filter(
        RevisionHistory.topic_preparation_id == prep.id
    ).order_by(RevisionHistory.revised_at.desc()).all()

    return [RevisionResponse.model_validate(r) for r in revisions]

@router.post("", response_model=TopicPreparationResponse, status_code=status.HTTP_201_CREATED)
def record_revision(
    exam_id: str,
    topic_id: str,
    payload: RevisionCreate,
    db: Session = Depends(get_db)
):
    """
    Records an independent revision event for this exam.
    If 'also_revise_exam_ids' is specified, explicitly records a revision
    for each of those exams without touching any unselected exams.
    """
    exam = db.query(Examination).filter(Examination.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found")
        
    topic = db.query(KnowledgeTopic).filter(KnowledgeTopic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Perform for main exam
    perform_revision(
        db=db,
        exam_id=exam_id,
        topic_id=topic_id,
        revision_notes=payload.revision_notes,
        confidence_before=payload.confidence_before,
        confidence_after=payload.confidence_after,
        spaced_interval_days=payload.spaced_interval_days
    )

    # Perform for explicitly selected secondary exams (if requested)
    if payload.also_revise_exam_ids:
        for other_exam_id in payload.also_revise_exam_ids:
            if other_exam_id != exam_id:
                other_exam = db.query(Examination).filter(Examination.id == other_exam_id).first()
                if other_exam:
                    perform_revision(
                        db=db,
                        exam_id=other_exam_id,
                        topic_id=topic_id,
                        revision_notes=f"[Synced from {exam.name}] {payload.revision_notes or ''}".strip(),
                        confidence_before=payload.confidence_before,
                        confidence_after=payload.confidence_after,
                        spaced_interval_days=payload.spaced_interval_days
                    )

    # Return refreshed preparation for current exam
    prep = db.query(TopicPreparation).filter(
        TopicPreparation.exam_id == exam_id,
        TopicPreparation.topic_id == topic_id
    ).first()
    
    revisions = db.query(RevisionHistory).filter(
        RevisionHistory.topic_preparation_id == prep.id
    ).order_by(RevisionHistory.revised_at.desc()).all()

    resp = TopicPreparationResponse.model_validate(prep)
    resp.revisions = [RevisionResponse.model_validate(r) for r in revisions]
    return resp
