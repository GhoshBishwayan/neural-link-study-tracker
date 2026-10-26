import csv
import io
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    Examination, Subject, ExamSubject, KnowledgeTopic, SubjectTopic,
    ExamSyllabusNode, TopicPreparation, RevisionHistory, TopicPrerequisite,
    ActivityHistory
)
from app.schemas import (
    FullDatabaseBackup, CSVImportPreviewResponse, CSVImportPreviewRow,
    CSVImportCommitRequest
)
from app.routers.common import log_activity

router = APIRouter(prefix="/backup", tags=["backup"])

@router.get("/export-csv")
def export_csv(exam_id: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Exports CSV with stable canonical IDs, notes, syllabus placement, and exam preparation.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    
    headers = [
        "topic_id", "title", "difficulty", "priority", "estimated_minutes",
        "general_notes", "exam_name", "subject_name", "syllabus_node_title",
        "preparation_status", "confidence_score", "revision_count", "personal_notes"
    ]
    writer.writerow(headers)
    
    query = db.query(ExamSyllabusNode).filter(ExamSyllabusNode.topic_id.isnot(None))
    if exam_id:
        query = query.filter(ExamSyllabusNode.exam_id == exam_id)
        
    nodes = query.all()
    
    for n in nodes:
        topic = n.topic
        exam = n.examination
        subj_name = ""
        if n.exam_subject and n.exam_subject.subject:
            subj_name = n.exam_subject.subject.name
            
        prep = db.query(TopicPreparation).filter(
            TopicPreparation.exam_id == n.exam_id,
            TopicPreparation.topic_id == n.topic_id
        ).first()

        writer.writerow([
            topic.id if topic else "",
            topic.title if topic else (n.title or ""),
            topic.difficulty if topic else 1,
            topic.priority if topic else 1,
            topic.estimated_minutes if topic else 60,
            (topic.general_notes or "") if topic else "",
            exam.name if exam else "",
            subj_name,
            n.title or "",
            prep.status if prep else "not_started",
            prep.confidence_score if prep else 1,
            prep.revision_count if prep else 0,
            prep.personal_notes if prep else ""
        ])

    csv_content = output.getvalue()
    filename = f"neurotree_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/csv-preview", response_model=CSVImportPreviewResponse)
async def preview_csv_import(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Parses an uploaded CSV and previews detected new topics, existing matches, and duplicates.
    """
    contents = await file.read()
    text = contents.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    
    all_topics = db.query(KnowledgeTopic).all()
    topics_by_id = {t.id: t for t in all_topics}
    topics_by_title = {t.title.strip().lower(): t for t in all_topics}

    rows_preview: List[CSVImportPreviewRow] = []
    new_count = 0
    link_count = 0
    dup_count = 0

    row_num = 1
    for row in reader:
        row_num += 1
        t_id = row.get("topic_id", "").strip() or None
        title = (row.get("title") or row.get("syllabus_node_title") or "").strip()
        if not title:
            continue
            
        subj_name = row.get("subject_name", "").strip() or None
        exam_name = row.get("exam_name", "").strip() or None
        status = row.get("preparation_status", "not_started").strip() or "not_started"
        try:
            conf = int(row.get("confidence_score", 1))
        except ValueError:
            conf = 1
        try:
            diff = int(row.get("difficulty", 1))
        except ValueError:
            diff = 1

        gen_notes = row.get("general_notes", "")
        pers_notes = row.get("personal_notes", "")

        matched_topic = None
        action = "create_new"
        
        # Check by ID first
        if t_id and t_id in topics_by_id:
            matched_topic = topics_by_id[t_id]
            action = "link_existing"
            link_count += 1
        elif title.lower() in topics_by_title:
            matched_topic = topics_by_title[title.lower()]
            action = "duplicate_warning" # Name match! Could link or separate
            dup_count += 1
        else:
            action = "create_new"
            new_count += 1

        rows_preview.append(CSVImportPreviewRow(
            row_number=row_num,
            canonical_id=t_id,
            title=title,
            subject_name=subj_name,
            exam_name=exam_name,
            action=action,
            matched_existing_topic_id=matched_topic.id if matched_topic else None,
            matched_existing_title=matched_topic.title if matched_topic else None,
            status=status,
            confidence=conf,
            difficulty=diff,
            general_notes=gen_notes,
            personal_notes=pers_notes
        ))

    return CSVImportPreviewResponse(
        total_rows=len(rows_preview),
        new_topics_count=new_count,
        existing_links_count=link_count,
        potential_duplicates_count=dup_count,
        rows=rows_preview
    )

@router.post("/csv-commit")
def commit_csv_import(payload: CSVImportCommitRequest, db: Session = Depends(get_db)):
    """
    Commits the previewed rows:
    - If action == 'create_new', creates canonical topic.
    - If action == 'link_existing' or user confirmed link, uses matched existing canonical topic.
    - Links to target exam & subject syllabus.
    - Initializes TopicPreparation.
    """
    created_topics = 0
    linked_nodes = 0

    for r in payload.rows:
        target_exam = None
        if payload.exam_id:
            target_exam = db.query(Examination).filter(Examination.id == payload.exam_id).first()
        elif r.exam_name:
            target_exam = db.query(Examination).filter(Examination.name == r.exam_name).first()
            if not target_exam:
                target_exam = Examination(name=r.exam_name, description="Imported Exam")
                db.add(target_exam)
                db.commit()
                db.refresh(target_exam)

        # Subject lookup or creation
        target_subject = None
        if r.subject_name:
            target_subject = db.query(Subject).filter(Subject.name == r.subject_name).first()
            if not target_subject:
                target_subject = Subject(name=r.subject_name)
                db.add(target_subject)
                db.commit()
                db.refresh(target_subject)

        exam_subject = None
        if target_exam and target_subject:
            exam_subject = db.query(ExamSubject).filter(
                ExamSubject.exam_id == target_exam.id,
                ExamSubject.subject_id == target_subject.id
            ).first()
            if not exam_subject:
                exam_subject = ExamSubject(
                    exam_id=target_exam.id,
                    subject_id=target_subject.id
                )
                db.add(exam_subject)
                db.commit()
                db.refresh(exam_subject)

        # Canonical topic handling
        topic = None
        if r.action == "link_existing" and r.matched_existing_topic_id:
            topic = db.query(KnowledgeTopic).filter(KnowledgeTopic.id == r.matched_existing_topic_id).first()
        elif r.action == "duplicate_warning" and r.matched_existing_topic_id:
            # If user kept duplicate_warning as link
            topic = db.query(KnowledgeTopic).filter(KnowledgeTopic.id == r.matched_existing_topic_id).first()
        
        if not topic:
            topic = KnowledgeTopic(
                title=r.title,
                general_notes=r.general_notes or "",
                difficulty=r.difficulty or 1
            )
            db.add(topic)
            db.commit()
            db.refresh(topic)
            created_topics += 1

        # Associate with SubjectTopic if subject exists
        if target_subject:
            st = db.query(SubjectTopic).filter(
                SubjectTopic.subject_id == target_subject.id,
                SubjectTopic.topic_id == topic.id
            ).first()
            if not st:
                st = SubjectTopic(subject_id=target_subject.id, topic_id=topic.id)
                db.add(st)
                db.commit()

        # Link to syllabus node if target exam exists
        if target_exam:
            node = ExamSyllabusNode(
                exam_id=target_exam.id,
                exam_subject_id=exam_subject.id if exam_subject else None,
                topic_id=topic.id,
                title=r.title,
                display_order=linked_nodes
            )
            db.add(node)
            db.commit()
            linked_nodes += 1

            # Exam Preparation
            prep = db.query(TopicPreparation).filter(
                TopicPreparation.exam_id == target_exam.id,
                TopicPreparation.topic_id == topic.id
            ).first()
            if not prep:
                prep = TopicPreparation(
                    exam_id=target_exam.id,
                    topic_id=topic.id,
                    status=r.status or "not_started",
                    confidence_score=r.confidence or 1,
                    personal_notes=r.personal_notes or ""
                )
                db.add(prep)
                db.commit()

    log_activity(db, "csv_imported", "system", None, payload.exam_id, f"Imported CSV: created {created_topics} topics, linked {linked_nodes} nodes.")
    db.commit()

    return {"message": f"Successfully imported: {created_topics} new topics created, {linked_nodes} syllabus nodes linked."}

@router.get("/export-full", response_model=FullDatabaseBackup)
def export_full_database(db: Session = Depends(get_db)):
    """
    Exports a complete snapshot of all entities and relationships in JSON.
    """
    return FullDatabaseBackup(
        exported_at=datetime.now(timezone.utc).isoformat(),
        examinations=[
            {"id": e.id, "name": e.name, "description": e.description, "exam_date": e.exam_date, "status": e.status, "created_at": e.created_at.isoformat() if e.created_at else None, "updated_at": e.updated_at.isoformat() if e.updated_at else None}
            for e in db.query(Examination).all()
        ],
        subjects=[
            {"id": s.id, "name": s.name, "description": s.description, "created_at": s.created_at.isoformat() if s.created_at else None, "updated_at": s.updated_at.isoformat() if s.updated_at else None}
            for s in db.query(Subject).all()
        ],
        exam_subjects=[
            {"id": es.id, "exam_id": es.exam_id, "subject_id": es.subject_id, "syllabus_description": es.syllabus_description, "display_order": es.display_order, "created_at": es.created_at.isoformat() if es.created_at else None}
            for es in db.query(ExamSubject).all()
        ],
        knowledge_topics=[
            {"id": kt.id, "title": kt.title, "description": kt.description, "general_notes": kt.general_notes, "difficulty": kt.difficulty, "priority": kt.priority, "estimated_minutes": kt.estimated_minutes, "created_at": kt.created_at.isoformat() if kt.created_at else None, "updated_at": kt.updated_at.isoformat() if kt.updated_at else None}
            for kt in db.query(KnowledgeTopic).all()
        ],
        subject_topics=[
            {"id": st.id, "subject_id": st.subject_id, "topic_id": st.topic_id, "parent_subject_topic_id": st.parent_subject_topic_id, "display_order": st.display_order}
            for st in db.query(SubjectTopic).all()
        ],
        exam_syllabus_nodes=[
            {"id": esn.id, "exam_id": esn.exam_id, "exam_subject_id": esn.exam_subject_id, "topic_id": esn.topic_id, "parent_node_id": esn.parent_node_id, "title": esn.title, "display_order": esn.display_order, "position_x": esn.position_x, "position_y": esn.position_y, "is_required": esn.is_required, "syllabus_notes": esn.syllabus_notes, "is_organizational": esn.is_organizational}
            for esn in db.query(ExamSyllabusNode).all()
        ],
        topic_preparations=[
            {"id": tp.id, "exam_id": tp.exam_id, "topic_id": tp.topic_id, "status": tp.status, "confidence_score": tp.confidence_score, "revision_count": tp.revision_count, "last_revised_at": tp.last_revised_at.isoformat() if tp.last_revised_at else None, "next_revision_at": tp.next_revision_at.isoformat() if tp.next_revision_at else None, "personal_notes": tp.personal_notes, "actual_study_minutes": tp.actual_study_minutes, "created_at": tp.created_at.isoformat() if tp.created_at else None, "updated_at": tp.updated_at.isoformat() if tp.updated_at else None}
            for tp in db.query(TopicPreparation).all()
        ],
        revision_histories=[
            {"id": rh.id, "topic_preparation_id": rh.topic_preparation_id, "revised_at": rh.revised_at.isoformat() if rh.revised_at else None, "revision_notes": rh.revision_notes, "confidence_before": rh.confidence_before, "confidence_after": rh.confidence_after}
            for rh in db.query(RevisionHistory).all()
        ],
        topic_prerequisites=[
            {"id": tpr.id, "topic_id": tpr.topic_id, "prerequisite_topic_id": tpr.prerequisite_topic_id}
            for tpr in db.query(TopicPrerequisite).all()
        ],
        activity_histories=[
            {"id": ah.id, "action_type": ah.action_type, "entity_type": ah.entity_type, "entity_id": ah.entity_id, "exam_id": ah.exam_id, "details": ah.details, "created_at": ah.created_at.isoformat() if ah.created_at else None}
            for ah in db.query(ActivityHistory).all()
        ]
    )

@router.post("/restore-full")
def restore_full_database(backup: FullDatabaseBackup, db: Session = Depends(get_db)):
    """
    TEST I Requirement:
    Restores complete backup into database, preserving all relationships,
    preparation records, and revision histories.
    """
    try:
        # Disable foreign keys temporarily during restore transaction
        db.execute(db.bind.connect().connection.cursor().execute("PRAGMA foreign_keys=OFF") if hasattr(db.bind, 'connect') else "SELECT 1")
    except Exception:
        pass

    # Clear all existing tables in reverse dependency order
    db.query(ActivityHistory).delete()
    db.query(RevisionHistory).delete()
    db.query(TopicPreparation).delete()
    db.query(ExamSyllabusNode).delete()
    db.query(TopicPrerequisite).delete()
    db.query(SubjectTopic).delete()
    db.query(ExamSubject).delete()
    db.query(KnowledgeTopic).delete()
    db.query(Subject).delete()
    db.query(Examination).delete()
    db.commit()

    # Re-insert Examinations
    for item in backup.examinations:
        db.add(Examination(
            id=item["id"],
            name=item["name"],
            description=item.get("description"),
            exam_date=item.get("exam_date"),
            status=item.get("status", "active")
        ))
    db.commit()

    # Re-insert Subjects
    for item in backup.subjects:
        db.add(Subject(
            id=item["id"],
            name=item["name"],
            description=item.get("description")
        ))
    db.commit()

    # Re-insert ExamSubjects
    for item in backup.exam_subjects:
        db.add(ExamSubject(
            id=item["id"],
            exam_id=item["exam_id"],
            subject_id=item["subject_id"],
            syllabus_description=item.get("syllabus_description"),
            display_order=item.get("display_order", 0)
        ))
    db.commit()

    # Re-insert KnowledgeTopics
    for item in backup.knowledge_topics:
        db.add(KnowledgeTopic(
            id=item["id"],
            title=item["title"],
            description=item.get("description"),
            general_notes=item.get("general_notes", ""),
            difficulty=item.get("difficulty", 1),
            priority=item.get("priority", 1),
            estimated_minutes=item.get("estimated_minutes", 60)
        ))
    db.commit()

    # Re-insert SubjectTopics
    for item in backup.subject_topics:
        db.add(SubjectTopic(
            id=item["id"],
            subject_id=item["subject_id"],
            topic_id=item["topic_id"],
            parent_subject_topic_id=item.get("parent_subject_topic_id"),
            display_order=item.get("display_order", 0)
        ))
    db.commit()

    # Re-insert ExamSyllabusNodes
    for item in backup.exam_syllabus_nodes:
        db.add(ExamSyllabusNode(
            id=item["id"],
            exam_id=item["exam_id"],
            exam_subject_id=item.get("exam_subject_id"),
            topic_id=item.get("topic_id"),
            parent_node_id=item.get("parent_node_id"),
            title=item.get("title"),
            display_order=item.get("display_order", 0),
            position_x=item.get("position_x", 0.0),
            position_y=item.get("position_y", 0.0),
            is_required=item.get("is_required", True),
            syllabus_notes=item.get("syllabus_notes"),
            is_organizational=item.get("is_organizational", False)
        ))
    db.commit()

    # Re-insert TopicPreparations
    for item in backup.topic_preparations:
        last_rev = datetime.fromisoformat(item["last_revised_at"]) if item.get("last_revised_at") else None
        next_rev = datetime.fromisoformat(item["next_revision_at"]) if item.get("next_revision_at") else None
        db.add(TopicPreparation(
            id=item["id"],
            exam_id=item["exam_id"],
            topic_id=item["topic_id"],
            status=item.get("status", "not_started"),
            confidence_score=item.get("confidence_score", 1),
            revision_count=item.get("revision_count", 0),
            last_revised_at=last_rev,
            next_revision_at=next_rev,
            personal_notes=item.get("personal_notes", ""),
            actual_study_minutes=item.get("actual_study_minutes", 0)
        ))
    db.commit()

    # Re-insert RevisionHistories
    for item in backup.revision_histories:
        rev_at = datetime.fromisoformat(item["revised_at"]) if item.get("revised_at") else datetime.now(timezone.utc)
        db.add(RevisionHistory(
            id=item["id"],
            topic_preparation_id=item["topic_preparation_id"],
            revised_at=rev_at,
            revision_notes=item.get("revision_notes", ""),
            confidence_before=item.get("confidence_before", 1),
            confidence_after=item.get("confidence_after", 1)
        ))
    db.commit()

    # Re-insert TopicPrerequisites
    for item in backup.topic_prerequisites:
        db.add(TopicPrerequisite(
            id=item["id"],
            topic_id=item["topic_id"],
            prerequisite_topic_id=item["prerequisite_topic_id"]
        ))
    db.commit()

    # Re-insert ActivityHistories
    for item in backup.activity_histories:
        act_at = datetime.fromisoformat(item["created_at"]) if item.get("created_at") else datetime.now(timezone.utc)
        db.add(ActivityHistory(
            id=item["id"],
            action_type=item["action_type"],
            entity_type=item["entity_type"],
            entity_id=item.get("entity_id"),
            exam_id=item.get("exam_id"),
            details=item.get("details", ""),
            created_at=act_at
        ))
    db.commit()

    log_activity(db, "database_restored", "system", None, None, "Database restored from backup snapshot.")
    db.commit()

    return {"message": "Database successfully restored from backup snapshot."}
