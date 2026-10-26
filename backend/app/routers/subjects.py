import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Subject, ExamSubject, SubjectTopic, KnowledgeTopic
from app.schemas import SubjectCreate, SubjectUpdate, SubjectResponse, KnowledgeTopicResponse
from app.routers.common import log_activity

router = APIRouter(prefix="/subjects", tags=["subjects"])

@router.get("", response_model=List[SubjectResponse])
def get_subjects(db: Session = Depends(get_db)):
    subjects = db.query(Subject).order_by(Subject.name.asc()).all()
    results = []
    for s in subjects:
        top_count = db.query(SubjectTopic).filter(SubjectTopic.subject_id == s.id).count()
        ex_count = db.query(ExamSubject).filter(ExamSubject.subject_id == s.id).count()
        results.append(SubjectResponse(
            id=s.id,
            name=s.name,
            description=s.description,
            created_at=s.created_at,
            updated_at=s.updated_at,
            topic_count=top_count,
            exam_count=ex_count
        ))
    return results

@router.post("", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject(payload: SubjectCreate, db: Session = Depends(get_db)):
    subject = Subject(
        name=payload.name,
        description=payload.description
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    log_activity(db, "subject_created", "subject", subject.id, None, f"Created subject: {subject.name}")
    db.commit()

    return SubjectResponse(
        id=subject.id,
        name=subject.name,
        description=subject.description,
        created_at=subject.created_at,
        updated_at=subject.updated_at,
        topic_count=0,
        exam_count=0
    )

@router.get("/{subject_id}", response_model=SubjectResponse)
def get_subject(subject_id: str, db: Session = Depends(get_db)):
    s = db.query(Subject).filter(Subject.id == subject_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    top_count = db.query(SubjectTopic).filter(SubjectTopic.subject_id == s.id).count()
    ex_count = db.query(ExamSubject).filter(ExamSubject.subject_id == s.id).count()
    return SubjectResponse(
        id=s.id,
        name=s.name,
        description=s.description,
        created_at=s.created_at,
        updated_at=s.updated_at,
        topic_count=top_count,
        exam_count=ex_count
    )

@router.put("/{subject_id}", response_model=SubjectResponse)
def update_subject(subject_id: str, payload: SubjectUpdate, db: Session = Depends(get_db)):
    s = db.query(Subject).filter(Subject.id == subject_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    if payload.name is not None:
        s.name = payload.name
    if payload.description is not None:
        s.description = payload.description
    db.commit()
    db.refresh(s)
    return get_subject(subject_id, db)

@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(subject_id: str, db: Session = Depends(get_db)):
    s = db.query(Subject).filter(Subject.id == subject_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    log_activity(db, "subject_deleted", "subject", subject_id, None, f"Deleted subject: {s.name}")
    db.delete(s)
    db.commit()
    return None

@router.get("/{subject_id}/topics", response_model=List[KnowledgeTopicResponse])
def get_subject_topics(subject_id: str, db: Session = Depends(get_db)):
    s = db.query(Subject).filter(Subject.id == subject_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    associations = db.query(SubjectTopic).filter(SubjectTopic.subject_id == subject_id).order_by(SubjectTopic.display_order.asc()).all()
    results = []
    for assoc in associations:
        t = db.query(KnowledgeTopic).filter(KnowledgeTopic.id == assoc.topic_id).first()
        if t:
            usage = db.query(SubjectTopic).filter(SubjectTopic.topic_id == t.id).count()
            results.append(KnowledgeTopicResponse(
                id=t.id,
                title=t.title,
                description=t.description,
                general_notes=t.general_notes or "",
                difficulty=t.difficulty,
                priority=t.priority,
                estimated_minutes=t.estimated_minutes,
                created_at=t.created_at,
                updated_at=t.updated_at,
                usage_count=usage
            ))
    return results

@router.post("/{subject_id}/topics/{topic_id}", status_code=status.HTTP_201_CREATED)
def associate_topic_with_subject(subject_id: str, topic_id: str, display_order: int = 0, db: Session = Depends(get_db)):
    s = db.query(Subject).filter(Subject.id == subject_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Subject not found")
    t = db.query(KnowledgeTopic).filter(KnowledgeTopic.id == topic_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    existing = db.query(SubjectTopic).filter(
        SubjectTopic.subject_id == subject_id,
        SubjectTopic.topic_id == topic_id
    ).first()
    if existing:
        return {"message": "Topic is already associated with this subject", "id": existing.id}
    
    st = SubjectTopic(
        subject_id=subject_id,
        topic_id=topic_id,
        display_order=display_order
    )
    db.add(st)
    db.commit()
    return {"message": "Associated topic with subject", "id": st.id}

@router.delete("/{subject_id}/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_topic_from_subject(subject_id: str, topic_id: str, db: Session = Depends(get_db)):
    existing = db.query(SubjectTopic).filter(
        SubjectTopic.subject_id == subject_id,
        SubjectTopic.topic_id == topic_id
    ).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Association not found")
    
    db.delete(existing)
    db.commit()
    return None
