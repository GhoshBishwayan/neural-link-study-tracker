import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    Examination, ExamSubject, KnowledgeTopic, ExamSyllabusNode,
    TopicPreparation, TopicPrerequisite, SubjectTopic
)
from app.schemas import (
    SyllabusNodeCreate, SyllabusNodeUpdate, SyllabusNodeResponse,
    BatchPositionUpdateRequest, KnowledgeTopicResponse, TopicPreparationResponse,
    CreateTopicAndSyllabusNodeRequest
)
from app.routers.common import log_activity

router = APIRouter(prefix="/examinations/{exam_id}/syllabus", tags=["syllabus"])

def enrich_node(node: ExamSyllabusNode, db: Session) -> SyllabusNodeResponse:
    topic_data = None
    prep_data = None
    prereq_ids = []

    if node.topic_id:
        topic = db.query(KnowledgeTopic).filter(KnowledgeTopic.id == node.topic_id).first()
        if topic:
            usage = db.query(ExamSyllabusNode).filter(ExamSyllabusNode.topic_id == topic.id).count()
            topic_data = KnowledgeTopicResponse(
                id=topic.id,
                title=topic.title,
                description=topic.description,
                general_notes=topic.general_notes or "",
                difficulty=topic.difficulty,
                priority=topic.priority,
                estimated_minutes=topic.estimated_minutes,
                created_at=topic.created_at,
                updated_at=topic.updated_at,
                usage_count=usage
            )
            # Prereqs
            prereqs = db.query(TopicPrerequisite).filter(TopicPrerequisite.topic_id == topic.id).all()
            prereq_ids = [p.prerequisite_topic_id for p in prereqs]

        prep = db.query(TopicPreparation).filter(
            TopicPreparation.exam_id == node.exam_id,
            TopicPreparation.topic_id == node.topic_id
        ).first()
        if prep:
            prep_data = TopicPreparationResponse.model_validate(prep)

    return SyllabusNodeResponse(
        id=node.id,
        exam_id=node.exam_id,
        exam_subject_id=node.exam_subject_id,
        topic_id=node.topic_id,
        parent_node_id=node.parent_node_id,
        title=node.title or (topic_data.title if topic_data else "Untitled Node"),
        display_order=node.display_order,
        position_x=node.position_x,
        position_y=node.position_y,
        is_required=node.is_required,
        syllabus_notes=node.syllabus_notes,
        is_organizational=node.is_organizational,
        topic=topic_data,
        preparation=prep_data,
        prerequisite_topic_ids=prereq_ids
    )

@router.get("", response_model=List[SyllabusNodeResponse])
def get_exam_syllabus(exam_id: str, db: Session = Depends(get_db)):
    exam = db.query(Examination).filter(Examination.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found")
        
    nodes = db.query(ExamSyllabusNode).filter(
        ExamSyllabusNode.exam_id == exam_id
    ).order_by(ExamSyllabusNode.display_order.asc()).all()

    return [enrich_node(node, db) for node in nodes]

@router.post("/nodes", response_model=SyllabusNodeResponse, status_code=status.HTTP_201_CREATED)
def add_syllabus_node(exam_id: str, payload: SyllabusNodeCreate, db: Session = Depends(get_db)):
    exam = db.query(Examination).filter(Examination.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found")
        
    # Check topic if provided
    topic = None
    if payload.topic_id:
        topic = db.query(KnowledgeTopic).filter(KnowledgeTopic.id == payload.topic_id).first()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")

    node = ExamSyllabusNode(
        exam_id=exam_id,
        exam_subject_id=payload.exam_subject_id,
        topic_id=payload.topic_id,
        parent_node_id=payload.parent_node_id,
        title=payload.title or (topic.title if topic else "Organizational Node"),
        display_order=payload.display_order or 0,
        position_x=payload.position_x or 0.0,
        position_y=payload.position_y or 0.0,
        is_required=payload.is_required if payload.is_required is not None else True,
        syllabus_notes=payload.syllabus_notes,
        is_organizational=payload.is_organizational or (payload.topic_id is None)
    )
    db.add(node)
    db.commit()
    db.refresh(node)

    # Ensure exam-specific TopicPreparation exists if this is a topic node
    if node.topic_id:
        existing_prep = db.query(TopicPreparation).filter(
            TopicPreparation.exam_id == exam_id,
            TopicPreparation.topic_id == node.topic_id
        ).first()
        if not existing_prep:
            prep = TopicPreparation(
                exam_id=exam_id,
                topic_id=node.topic_id,
                status="not_started",
                confidence_score=1,
                revision_count=0
            )
            db.add(prep)
            db.commit()

        # If subject association exists, link to SubjectTopic as well if not already linked
        if payload.exam_subject_id:
            exam_subj = db.query(ExamSubject).filter(ExamSubject.id == payload.exam_subject_id).first()
            if exam_subj:
                st = db.query(SubjectTopic).filter(
                    SubjectTopic.subject_id == exam_subj.subject_id,
                    SubjectTopic.topic_id == node.topic_id
                ).first()
                if not st:
                    st = SubjectTopic(
                        subject_id=exam_subj.subject_id,
                        topic_id=node.topic_id,
                        display_order=node.display_order
                    )
                    db.add(st)
                    db.commit()

    log_activity(db, "syllabus_node_added", "syllabus_node", node.id, exam_id, f"Added syllabus node: {node.title}")
    db.commit()

    return enrich_node(node, db)

@router.post("/create-and-link", response_model=SyllabusNodeResponse, status_code=status.HTTP_201_CREATED)
def create_and_link_topic(exam_id: str, payload: CreateTopicAndSyllabusNodeRequest, db: Session = Depends(get_db)):
    """
    Creates a new canonical KnowledgeTopic and links it as a syllabus node in this examination.
    """
    exam = db.query(Examination).filter(Examination.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found")

    # 1. Create canonical topic
    topic = KnowledgeTopic(
        title=payload.topic.title,
        description=payload.topic.description,
        general_notes=payload.topic.general_notes or "",
        difficulty=payload.topic.difficulty,
        priority=payload.topic.priority,
        estimated_minutes=payload.topic.estimated_minutes
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)

    # Prerequisites
    if payload.topic.prerequisite_ids:
        for prereq_id in payload.topic.prerequisite_ids:
            if prereq_id != topic.id:
                prereq = TopicPrerequisite(topic_id=topic.id, prerequisite_topic_id=prereq_id)
                db.add(prereq)
        db.commit()

    # 2. Create Syllabus Node
    node = ExamSyllabusNode(
        exam_id=exam_id,
        exam_subject_id=payload.exam_subject_id,
        topic_id=topic.id,
        parent_node_id=payload.parent_node_id,
        title=topic.title,
        position_x=payload.position_x or 0.0,
        position_y=payload.position_y or 0.0,
        is_required=payload.is_required if payload.is_required is not None else True,
        is_organizational=False
    )
    db.add(node)
    db.commit()
    db.refresh(node)

    # 3. Create TopicPreparation for this exam
    prep = TopicPreparation(
        exam_id=exam_id,
        topic_id=topic.id,
        status="not_started",
        confidence_score=1,
        revision_count=0
    )
    db.add(prep)
    
    # 4. If associated with an exam_subject, link to SubjectTopic
    if payload.exam_subject_id:
        exam_subj = db.query(ExamSubject).filter(ExamSubject.id == payload.exam_subject_id).first()
        if exam_subj:
            st = SubjectTopic(
                subject_id=exam_subj.subject_id,
                topic_id=topic.id,
                display_order=0
            )
            db.add(st)

    db.commit()
    log_activity(db, "topic_created_and_linked", "syllabus_node", node.id, exam_id, f"Created topic '{topic.title}' and linked to '{exam.name}'")
    db.commit()

    return enrich_node(node, db)

@router.patch("/positions", status_code=status.HTTP_200_OK)
def update_node_positions(exam_id: str, payload: BatchPositionUpdateRequest, db: Session = Depends(get_db)):
    """
    Saves drag-and-drop tree layout coordinates for the specified examination.
    """
    exam = db.query(Examination).filter(Examination.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Examination not found")

    for item in payload.positions:
        node = db.query(ExamSyllabusNode).filter(
            ExamSyllabusNode.id == item.id,
            ExamSyllabusNode.exam_id == exam_id
        ).first()
        if node:
            node.position_x = item.position_x
            node.position_y = item.position_y
            
    db.commit()
    return {"message": f"Updated positions for {len(payload.positions)} nodes in exam {exam_id}"}

@router.put("/nodes/{node_id}", response_model=SyllabusNodeResponse)
def update_syllabus_node(exam_id: str, node_id: str, payload: SyllabusNodeUpdate, db: Session = Depends(get_db)):
    node = db.query(ExamSyllabusNode).filter(
        ExamSyllabusNode.id == node_id,
        ExamSyllabusNode.exam_id == exam_id
    ).first()
    if not node:
        raise HTTPException(status_code=404, detail="Syllabus node not found")

    if payload.title is not None:
        node.title = payload.title
    if payload.parent_node_id is not None:
        node.parent_node_id = payload.parent_node_id
    if payload.display_order is not None:
        node.display_order = payload.display_order
    if payload.position_x is not None:
        node.position_x = payload.position_x
    if payload.position_y is not None:
        node.position_y = payload.position_y
    if payload.is_required is not None:
        node.is_required = payload.is_required
    if payload.syllabus_notes is not None:
        node.syllabus_notes = payload.syllabus_notes

    db.commit()
    db.refresh(node)
    return enrich_node(node, db)

@router.delete("/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_syllabus_node(exam_id: str, node_id: str, db: Session = Depends(get_db)):
    """
    Removes the syllabus node from the examination.
    Does NOT delete the canonical knowledge topic or affect other examinations.
    """
    node = db.query(ExamSyllabusNode).filter(
        ExamSyllabusNode.id == node_id,
        ExamSyllabusNode.exam_id == exam_id
    ).first()
    if not node:
        raise HTTPException(status_code=404, detail="Syllabus node not found")

    # Re-parent children if any
    children = db.query(ExamSyllabusNode).filter(ExamSyllabusNode.parent_node_id == node_id).all()
    for child in children:
        child.parent_node_id = node.parent_node_id

    log_activity(db, "syllabus_node_deleted", "syllabus_node", node_id, exam_id, f"Deleted syllabus node: {node.title}")
    db.delete(node)
    db.commit()
    return None
