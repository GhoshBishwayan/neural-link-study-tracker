from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import TopicPreparation, KnowledgeTopic, Examination, RevisionHistory
from app.schemas import TopicPreparationUpdate, TopicPreparationResponse, RevisionResponse
from app.routers.common import log_activity

router = APIRouter(prefix="/examinations/{exam_id}/topics/{topic_id}/preparation", tags=["preparation"])

@router.get("", response_model=TopicPreparationResponse)
def get_topic_preparation(exam_id: str, topic_id: str, db: Session = Depends(get_db)):
    prep = db.query(TopicPreparation).filter(
        TopicPreparation.exam_id == exam_id,
        TopicPreparation.topic_id == topic_id
    ).first()
    
    if not prep:
        # If preparation record does not exist yet, create one lazily
        exam = db.query(Examination).filter(Examination.id == exam_id).first()
        topic = db.query(KnowledgeTopic).filter(KnowledgeTopic.id == topic_id).first()
        if not exam or not topic:
            raise HTTPException(status_code=404, detail="Exam or topic not found")
        
        prep = TopicPreparation(
            exam_id=exam_id,
            topic_id=topic_id,
            status="not_started",
            confidence_score=1,
            revision_count=0
        )
        db.add(prep)
        db.commit()
        db.refresh(prep)

    revisions = db.query(RevisionHistory).filter(
        RevisionHistory.topic_preparation_id == prep.id
    ).order_by(RevisionHistory.revised_at.desc()).all()

    resp = TopicPreparationResponse.model_validate(prep)
    resp.revisions = [RevisionResponse.model_validate(r) for r in revisions]
    return resp

@router.put("", response_model=TopicPreparationResponse)
def update_topic_preparation(
    exam_id: str,
    topic_id: str,
    payload: TopicPreparationUpdate,
    db: Session = Depends(get_db)
):
    prep = db.query(TopicPreparation).filter(
        TopicPreparation.exam_id == exam_id,
        TopicPreparation.topic_id == topic_id
    ).first()
    
    if not prep:
        exam = db.query(Examination).filter(Examination.id == exam_id).first()
        topic = db.query(KnowledgeTopic).filter(KnowledgeTopic.id == topic_id).first()
        if not exam or not topic:
            raise HTTPException(status_code=404, detail="Exam or topic not found")
        
        prep = TopicPreparation(
            exam_id=exam_id,
            topic_id=topic_id,
            status="not_started",
            confidence_score=1,
            revision_count=0
        )
        db.add(prep)
        db.commit()
        db.refresh(prep)

    old_status = prep.status
    if payload.status is not None:
        prep.status = payload.status
    if payload.confidence_score is not None:
        prep.confidence_score = payload.confidence_score
    if payload.personal_notes is not None:
        prep.personal_notes = payload.personal_notes
    if payload.actual_study_minutes is not None:
        prep.actual_study_minutes = payload.actual_study_minutes
    if payload.next_revision_at is not None:
        prep.next_revision_at = payload.next_revision_at

    prep.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(prep)

    if payload.status and payload.status != old_status:
        topic = db.query(KnowledgeTopic).filter(KnowledgeTopic.id == topic_id).first()
        title = topic.title if topic else topic_id
        log_activity(
            db,
            "preparation_status_changed",
            "preparation",
            prep.id,
            exam_id,
            f"Changed status for '{title}' to {payload.status}"
        )
        db.commit()

    revisions = db.query(RevisionHistory).filter(
        RevisionHistory.topic_preparation_id == prep.id
    ).order_by(RevisionHistory.revised_at.desc()).all()

    resp = TopicPreparationResponse.model_validate(prep)
    resp.revisions = [RevisionResponse.model_validate(r) for r in revisions]
    return resp
