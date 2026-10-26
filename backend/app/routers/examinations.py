import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import (
    Examination, Subject, ExamSubject, ExamSyllabusNode, TopicPreparation
)
from app.schemas import (
    ExaminationCreate, ExaminationUpdate, ExaminationResponse,
    ExamSubjectCreate, ExamSubjectResponse
)
from app.routers.common import log_activity

router = APIRouter(prefix="/examinations", tags=["examinations"])

@router.get("", response_model=List[ExaminationResponse])
def get_examinations(db: Session = Depends(get_db)):
    exams = db.query(Examination).order_by(Examination.created_at.desc()).all()
    results = []
    for exam in exams:
        sub_count = db.query(ExamSubject).filter(ExamSubject.exam_id == exam.id).count()
        nodes = db.query(ExamSyllabusNode).filter(
            ExamSyllabusNode.exam_id == exam.id,
            ExamSyllabusNode.topic_id.isnot(None)
        ).all()
        topic_count = len(nodes)
        
        # Count distinct completed topics for this exam
        completed_count = db.query(TopicPreparation).filter(
            TopicPreparation.exam_id == exam.id,
            TopicPreparation.status == "completed"
        ).count()

        prog_pct = round((completed_count / topic_count * 100), 1) if topic_count > 0 else 0.0

        item = ExaminationResponse(
            id=exam.id,
            name=exam.name,
            description=exam.description,
            exam_date=exam.exam_date,
            status=exam.status,
            created_at=exam.created_at,
            updated_at=exam.updated_at,
            subject_count=sub_count,
            topic_count=topic_count,
            completed_topic_count=completed_count,
            progress_percentage=prog_pct
        )
        results.append(item)
    return results

@router.post("", response_model=ExaminationResponse, status_code=status.HTTP_201_CREATED)
def create_examination(payload: ExaminationCreate, db: Session = Depends(get_db)):
    exam = Examination(
        name=payload.name,
        description=payload.description,
        exam_date=payload.exam_date,
        status=payload.status or "active"
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)
    log_activity(db, "exam_created", "exam", exam.id, exam.id, f"Created examination: {exam.name}")
    db.commit()
    
    return ExaminationResponse(
        id=exam.id,
        name=exam.name,
        description=exam.description,
        exam_date=exam.exam_date,
        status=exam.status,
        created_at=exam.created_at,
        updated_at=exam.updated_at,
        subject_count=0,
        topic_count=0,
        completed_topic_count=0,
        progress_percentage=0.0
    )

@router.get("/{exam_id}", response_model=ExaminationResponse)
def get_examination(exam_id: str, db: Session = Depends(get_db)):
    exam = db.query(Examination).filter(Examination.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found")
    
    sub_count = db.query(ExamSubject).filter(ExamSubject.exam_id == exam.id).count()
    topic_count = db.query(ExamSyllabusNode).filter(
        ExamSyllabusNode.exam_id == exam.id,
        ExamSyllabusNode.topic_id.isnot(None)
    ).count()
    completed_count = db.query(TopicPreparation).filter(
        TopicPreparation.exam_id == exam.id,
        TopicPreparation.status == "completed"
    ).count()
    prog_pct = round((completed_count / topic_count * 100), 1) if topic_count > 0 else 0.0

    return ExaminationResponse(
        id=exam.id,
        name=exam.name,
        description=exam.description,
        exam_date=exam.exam_date,
        status=exam.status,
        created_at=exam.created_at,
        updated_at=exam.updated_at,
        subject_count=sub_count,
        topic_count=topic_count,
        completed_topic_count=completed_count,
        progress_percentage=prog_pct
    )

@router.put("/{exam_id}", response_model=ExaminationResponse)
def update_examination(exam_id: str, payload: ExaminationUpdate, db: Session = Depends(get_db)):
    exam = db.query(Examination).filter(Examination.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found")
    
    if payload.name is not None:
        exam.name = payload.name
    if payload.description is not None:
        exam.description = payload.description
    if payload.exam_date is not None:
        exam.exam_date = payload.exam_date
    if payload.status is not None:
        exam.status = payload.status
    
    db.commit()
    db.refresh(exam)
    return get_examination(exam_id, db)

@router.delete("/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_examination(exam_id: str, db: Session = Depends(get_db)):
    exam = db.query(Examination).filter(Examination.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found")
    
    log_activity(db, "exam_deleted", "exam", exam_id, None, f"Deleted examination: {exam.name}")
    db.delete(exam)
    db.commit()
    return None

# Exam-Subject Association endpoints
@router.get("/{exam_id}/subjects", response_model=List[ExamSubjectResponse])
def get_exam_subjects(exam_id: str, db: Session = Depends(get_db)):
    exam = db.query(Examination).filter(Examination.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found")
    
    assoc_list = db.query(ExamSubject).filter(ExamSubject.exam_id == exam_id).order_by(ExamSubject.display_order.asc()).all()
    results = []
    for a in assoc_list:
        sub = db.query(Subject).filter(Subject.id == a.subject_id).first()
        results.append(ExamSubjectResponse(
            id=a.id,
            exam_id=a.exam_id,
            subject_id=a.subject_id,
            syllabus_description=a.syllabus_description,
            display_order=a.display_order,
            subject_name=sub.name if sub else "Unknown"
        ))
    return results

@router.post("/{exam_id}/subjects", response_model=ExamSubjectResponse, status_code=status.HTTP_201_CREATED)
def associate_subject_with_exam(exam_id: str, payload: ExamSubjectCreate, db: Session = Depends(get_db)):
    exam = db.query(Examination).filter(Examination.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found")
    
    subject = db.query(Subject).filter(Subject.id == payload.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    existing = db.query(ExamSubject).filter(
        ExamSubject.exam_id == exam_id,
        ExamSubject.subject_id == payload.subject_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Subject is already associated with this examination")
    
    assoc = ExamSubject(
        exam_id=exam_id,
        subject_id=payload.subject_id,
        syllabus_description=payload.syllabus_description,
        display_order=payload.display_order or 0
    )
    db.add(assoc)
    db.commit()
    db.refresh(assoc)
    
    log_activity(db, "subject_associated", "exam_subject", assoc.id, exam_id, f"Associated subject '{subject.name}' with exam '{exam.name}'")
    db.commit()

    return ExamSubjectResponse(
        id=assoc.id,
        exam_id=assoc.exam_id,
        subject_id=assoc.subject_id,
        syllabus_description=assoc.syllabus_description,
        display_order=assoc.display_order,
        subject_name=subject.name
    )

@router.delete("/{exam_id}/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_subject_from_exam(exam_id: str, subject_id: str, db: Session = Depends(get_db)):
    """
    TEST F Requirement:
    Removing a subject from an examination disassociates it from that exam
    WITHOUT deleting the reusable Subject or canonical topics in the knowledge base.
    """
    assoc = db.query(ExamSubject).filter(
        ExamSubject.exam_id == exam_id,
        ExamSubject.subject_id == subject_id
    ).first()
    if not assoc:
        raise HTTPException(status_code=404, detail="Subject association not found for this examination")
    
    # Detach or delete syllabus nodes associated with this exam_subject for this exam
    db.query(ExamSyllabusNode).filter(
        ExamSyllabusNode.exam_id == exam_id,
        ExamSyllabusNode.exam_subject_id == assoc.id
    ).delete(synchronize_session=False)

    db.delete(assoc)
    log_activity(db, "subject_disassociated", "exam_subject", None, exam_id, f"Removed subject from exam")
    db.commit()
    return None
