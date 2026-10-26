import uuid
from typing import List, Optional
from difflib import SequenceMatcher
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    KnowledgeTopic, Subject, SubjectTopic, ExamSyllabusNode,
    Examination, TopicPreparation, TopicPrerequisite
)
from app.schemas import (
    KnowledgeTopicCreate, KnowledgeTopicUpdate, KnowledgeTopicResponse,
    DuplicateCheckResponse, DuplicateCheckMatch, TopicUsageResponse, TopicUsageExamItem,
    PrerequisiteCreate, PrerequisiteInfo
)
from app.routers.common import log_activity

router = APIRouter(prefix="/topics", tags=["topics"])

def check_circular_dependency(db: Session, topic_id: str, new_prereq_id: str) -> bool:
    """
    Returns True if adding new_prereq_id as a prerequisite to topic_id would cause a cycle.
    That is, if topic_id is already an ancestor prerequisite of new_prereq_id.
    """
    if topic_id == new_prereq_id:
        return True
    
    visited = set()
    queue = [new_prereq_id]
    
    while queue:
        current = queue.pop(0)
        if current == topic_id:
            return True
        if current in visited:
            continue
        visited.add(current)
        
        prereqs = db.query(TopicPrerequisite).filter(TopicPrerequisite.topic_id == current).all()
        for p in prereqs:
            queue.append(p.prerequisite_topic_id)
            
    return False

@router.get("", response_model=List[KnowledgeTopicResponse])
def get_topics(
    q: Optional[str] = None,
    difficulty: Optional[int] = None,
    priority: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(KnowledgeTopic)
    if q:
        query = query.filter(KnowledgeTopic.title.ilike(f"%{q}%"))
    if difficulty:
        query = query.filter(KnowledgeTopic.difficulty == difficulty)
    if priority:
        query = query.filter(KnowledgeTopic.priority == priority)
        
    topics = query.order_by(KnowledgeTopic.title.asc()).all()
    results = []
    for t in topics:
        usage = db.query(ExamSyllabusNode).filter(ExamSyllabusNode.topic_id == t.id).count()
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

@router.get("/check-duplicate", response_model=DuplicateCheckResponse)
def check_duplicate(title: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    """
    Check if a topic with a matching or similar title already exists.
    Returns matched topics with subject contexts and exam usage.
    """
    all_topics = db.query(KnowledgeTopic).all()
    clean_query = title.strip().lower()
    
    exact_match = None
    similar_matches = []
    
    for t in all_topics:
        t_clean = t.title.strip().lower()
        
        # Gather subject context
        subjects = [
            st.subject.name for st in t.subject_topics if st.subject
        ]
        
        # Gather exams where used
        exams = db.query(Examination.name).join(
            ExamSyllabusNode, ExamSyllabusNode.exam_id == Examination.id
        ).filter(ExamSyllabusNode.topic_id == t.id).distinct().all()
        exam_names = [e[0] for e in exams]

        if t_clean == clean_query:
            exact_match = DuplicateCheckMatch(
                id=t.id,
                title=t.title,
                similarity_score=1.0,
                description=t.description,
                subjects=subjects,
                used_in_exams=exam_names
            )
        else:
            sim = SequenceMatcher(None, clean_query, t_clean).ratio()
            # Also check if substring
            if clean_query in t_clean or t_clean in clean_query:
                sim = max(sim, 0.75)
                
            if sim >= 0.65:
                similar_matches.append(DuplicateCheckMatch(
                    id=t.id,
                    title=t.title,
                    similarity_score=round(sim, 2),
                    description=t.description,
                    subjects=subjects,
                    used_in_exams=exam_names
                ))
    
    # Sort similar matches by score descending
    similar_matches.sort(key=lambda x: x.similarity_score, reverse=True)
    
    return DuplicateCheckResponse(
        query=title,
        exact_match=exact_match,
        similar_matches=similar_matches[:5]
    )

@router.post("", response_model=KnowledgeTopicResponse, status_code=status.HTTP_201_CREATED)
def create_topic(payload: KnowledgeTopicCreate, db: Session = Depends(get_db)):
    topic = KnowledgeTopic(
        title=payload.title,
        description=payload.description,
        general_notes=payload.general_notes or "",
        difficulty=payload.difficulty,
        priority=payload.priority,
        estimated_minutes=payload.estimated_minutes
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)
    
    # Handle prerequisites if provided
    if payload.prerequisite_ids:
        for prereq_id in payload.prerequisite_ids:
            if prereq_id != topic.id and not check_circular_dependency(db, topic.id, prereq_id):
                prereq = TopicPrerequisite(topic_id=topic.id, prerequisite_topic_id=prereq_id)
                db.add(prereq)
        db.commit()

    log_activity(db, "topic_created", "topic", topic.id, None, f"Created canonical topic: {topic.title}")
    db.commit()
    
    return KnowledgeTopicResponse(
        id=topic.id,
        title=topic.title,
        description=topic.description,
        general_notes=topic.general_notes or "",
        difficulty=topic.difficulty,
        priority=topic.priority,
        estimated_minutes=topic.estimated_minutes,
        created_at=topic.created_at,
        updated_at=topic.updated_at,
        usage_count=0
    )

@router.get("/{topic_id}", response_model=KnowledgeTopicResponse)
def get_topic(topic_id: str, db: Session = Depends(get_db)):
    t = db.query(KnowledgeTopic).filter(KnowledgeTopic.id == topic_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    usage = db.query(ExamSyllabusNode).filter(ExamSyllabusNode.topic_id == t.id).count()
    return KnowledgeTopicResponse(
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
    )

@router.put("/{topic_id}", response_model=KnowledgeTopicResponse)
def update_topic(topic_id: str, payload: KnowledgeTopicUpdate, db: Session = Depends(get_db)):
    t = db.query(KnowledgeTopic).filter(KnowledgeTopic.id == topic_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    if payload.title is not None:
        t.title = payload.title
    if payload.description is not None:
        t.description = payload.description
    if payload.general_notes is not None:
        t.general_notes = payload.general_notes
    if payload.difficulty is not None:
        t.difficulty = payload.difficulty
    if payload.priority is not None:
        t.priority = payload.priority
    if payload.estimated_minutes is not None:
        t.estimated_minutes = payload.estimated_minutes

    db.commit()
    db.refresh(t)
    
    log_activity(db, "topic_updated", "topic", t.id, None, f"Updated canonical topic: {t.title}")
    db.commit()

    usage = db.query(ExamSyllabusNode).filter(ExamSyllabusNode.topic_id == t.id).count()
    return KnowledgeTopicResponse(
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
    )

@router.get("/{topic_id}/usage", response_model=TopicUsageResponse)
def get_topic_usage(topic_id: str, db: Session = Depends(get_db)):
    """
    Requirement 4: Provide an interface for viewing where a topic is reused.
    Shows all examinations using this topic, syllabus titles, and their individual preparation statuses.
    """
    t = db.query(KnowledgeTopic).filter(KnowledgeTopic.id == topic_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    nodes = db.query(ExamSyllabusNode).filter(ExamSyllabusNode.topic_id == topic_id).all()
    exam_items = []
    
    seen_exams = set()
    for node in nodes:
        exam = node.examination
        if not exam or exam.id in seen_exams:
            continue
        seen_exams.add(exam.id)
        
        # Get prep for this exam
        prep = db.query(TopicPreparation).filter(
            TopicPreparation.exam_id == exam.id,
            TopicPreparation.topic_id == topic_id
        ).first()
        
        exam_items.append(TopicUsageExamItem(
            exam_id=exam.id,
            exam_name=exam.name,
            syllabus_node_id=node.id,
            syllabus_title=node.title or t.title,
            preparation_status=prep.status if prep else "not_started",
            confidence_score=prep.confidence_score if prep else 1,
            revision_count=prep.revision_count if prep else 0,
            last_revised_at=prep.last_revised_at if prep else None
        ))
        
    return TopicUsageResponse(
        topic_id=t.id,
        title=t.title,
        used_in_exams=exam_items
    )

@router.delete("/{topic_id}", status_code=status.HTTP_200_OK)
def delete_topic(topic_id: str, force: bool = Query(False), db: Session = Depends(get_db)):
    """
    TEST J Requirement:
    Deletion safety: When deleting a canonical topic used by multiple examinations,
    explain the consequences and require confirmation (force=true).
    """
    t = db.query(KnowledgeTopic).filter(KnowledgeTopic.id == topic_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Check where it is used
    exam_nodes = db.query(ExamSyllabusNode).filter(ExamSyllabusNode.topic_id == topic_id).all()
    exam_ids = list({node.exam_id for node in exam_nodes if node.exam_id})
    
    if len(exam_ids) > 1 and not force:
        exams = db.query(Examination.name).filter(Examination.id.in_(exam_ids)).all()
        exam_names = [e[0] for e in exams]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": f"Canonical topic '{t.title}' is currently used in {len(exam_names)} examinations: {', '.join(exam_names)}. Deleting it will remove it from all examinations and delete all related preparation history.",
                "used_in_exams": exam_names,
                "requires_confirmation": True
            }
        )
    
    log_activity(db, "topic_deleted", "topic", topic_id, None, f"Deleted canonical topic: {t.title}")
    db.delete(t)
    db.commit()
    return {"message": f"Topic '{t.title}' successfully deleted."}

# Prerequisites endpoints
@router.get("/{topic_id}/prerequisites", response_model=List[PrerequisiteInfo])
def get_prerequisites(topic_id: str, db: Session = Depends(get_db)):
    t = db.query(KnowledgeTopic).filter(KnowledgeTopic.id == topic_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    prereqs = db.query(TopicPrerequisite).filter(TopicPrerequisite.topic_id == topic_id).all()
    results = []
    for p in prereqs:
        target = db.query(KnowledgeTopic).filter(KnowledgeTopic.id == p.prerequisite_topic_id).first()
        results.append(PrerequisiteInfo(
            id=p.id,
            topic_id=p.topic_id,
            prerequisite_topic_id=p.prerequisite_topic_id,
            prerequisite_title=target.title if target else "Unknown"
        ))
    return results

@router.post("/{topic_id}/prerequisites", response_model=PrerequisiteInfo, status_code=status.HTTP_201_CREATED)
def add_prerequisite(topic_id: str, payload: PrerequisiteCreate, db: Session = Depends(get_db)):
    if topic_id == payload.prerequisite_topic_id:
        raise HTTPException(status_code=400, detail="A topic cannot be a prerequisite of itself.")
    
    target = db.query(KnowledgeTopic).filter(KnowledgeTopic.id == payload.prerequisite_topic_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Prerequisite topic not found")
        
    if check_circular_dependency(db, topic_id, payload.prerequisite_topic_id):
        raise HTTPException(status_code=400, detail="Adding this prerequisite would create a circular dependency.")
        
    existing = db.query(TopicPrerequisite).filter(
        TopicPrerequisite.topic_id == topic_id,
        TopicPrerequisite.prerequisite_topic_id == payload.prerequisite_topic_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Prerequisite relationship already exists.")
        
    prereq = TopicPrerequisite(topic_id=topic_id, prerequisite_topic_id=payload.prerequisite_topic_id)
    db.add(prereq)
    db.commit()
    db.refresh(prereq)
    
    return PrerequisiteInfo(
        id=prereq.id,
        topic_id=prereq.topic_id,
        prerequisite_topic_id=prereq.prerequisite_topic_id,
        prerequisite_title=target.title
    )

@router.delete("/{topic_id}/prerequisites/{prerequisite_topic_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_prerequisite(topic_id: str, prerequisite_topic_id: str, db: Session = Depends(get_db)):
    existing = db.query(TopicPrerequisite).filter(
        TopicPrerequisite.topic_id == topic_id,
        TopicPrerequisite.prerequisite_topic_id == prerequisite_topic_id
    ).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Prerequisite relationship not found")
        
    db.delete(existing)
    db.commit()
    return None
