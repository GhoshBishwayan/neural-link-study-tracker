import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.models import (
    Examination, Subject, ExamSubject, KnowledgeTopic, SubjectTopic,
    ExamSyllabusNode, TopicPreparation, RevisionHistory, TopicPrerequisite
)

def seed_database(db: Session):
    # Check if data already exists
    if db.query(Examination).first():
        return

    # 1. Create Examinations
    ugc_net = Examination(
        name="UGC NET Computer Science",
        description="National Eligibility Test for Assistant Professor and JRF in Computer Science & Applications.",
        exam_date="2026-12-15",
        status="active"
    )
    gate_cs = Examination(
        name="GATE Computer Science",
        description="Graduate Aptitude Test in Engineering for CS & IT Master's admissions and PSU recruitments.",
        exam_date="2027-02-07",
        status="active"
    )
    db.add_all([ugc_net, gate_cs])
    db.commit()

    # 2. Reusable Subjects
    dsa = Subject(
        name="Data Structures and Algorithms",
        description="Fundamental computational structures, algorithm design paradigms, sorting, searching, and complexity."
    )
    db_systems = Subject(
        name="Database Management Systems",
        description="Relational models, SQL, normalization, transactions, ACID properties, and indexing."
    )
    db.add_all([dsa, db_systems])
    db.commit()

    # 3. Associate Subject with both Examinations
    es_ugc_dsa = ExamSubject(
        exam_id=ugc_net.id,
        subject_id=dsa.id,
        syllabus_description="Unit 8: Data Structures and Algorithms",
        display_order=1
    )
    es_gate_dsa = ExamSubject(
        exam_id=gate_cs.id,
        subject_id=dsa.id,
        syllabus_description="Section 2: Programming and Data Structures, Algorithms",
        display_order=1
    )
    es_gate_db = ExamSubject(
        exam_id=gate_cs.id,
        subject_id=db_systems.id,
        syllabus_description="Section 4: Databases",
        display_order=2
    )
    db.add_all([es_ugc_dsa, es_gate_dsa, es_gate_db])
    db.commit()

    # 4. Canonical Knowledge Topics
    topic_asymp = KnowledgeTopic(
        title="Asymptotic Analysis & Big-O",
        description="Mathematical notation to describe the limiting behavior of execution time and space.",
        general_notes=(
            "### Big-O, Theta, and Omega\n"
            "- **Big-O (O)**: Upper asymptotic bound.\n"
            "- **Omega (Ω)**: Lower asymptotic bound.\n"
            "- **Theta (Θ)**: Tight asymptotic bound.\n\n"
            "Master Theorem: T(n) = aT(n/b) + f(n)."
        ),
        difficulty=2,
        priority=5,
        estimated_minutes=90
    )
    topic_bsearch = KnowledgeTopic(
        title="Binary Search",
        description="Efficient search algorithm for sorted collections with logarithmic time complexity.",
        general_notes=(
            "### Binary Search Algorithm\n"
            "Repeatedly divides a sorted search space in half.\n"
            "- **Time Complexity**: O(log n) worst/average, O(1) best.\n"
            "- **Space Complexity**: O(1) iterative, O(log n) recursive.\n"
            "- **Key Invariant**: Array must be sorted monotonically."
        ),
        difficulty=2,
        priority=4,
        estimated_minutes=60
    )
    topic_dp = KnowledgeTopic(
        title="Dynamic Programming",
        description="Optimization method using optimal substructure and overlapping subproblems.",
        general_notes=(
            "### Dynamic Programming\n"
            "- Memoization (Top-Down) vs Tabulation (Bottom-Up).\n"
            "- Common patterns: 0/1 Knapsack, LCS, LIS, Matrix Chain Multiplication."
        ),
        difficulty=4,
        priority=5,
        estimated_minutes=150
    )
    db.add_all([topic_asymp, topic_bsearch, topic_dp])
    db.commit()

    # Subject Topics
    db.add_all([
        SubjectTopic(subject_id=dsa.id, topic_id=topic_asymp.id, display_order=1),
        SubjectTopic(subject_id=dsa.id, topic_id=topic_bsearch.id, display_order=2),
        SubjectTopic(subject_id=dsa.id, topic_id=topic_dp.id, display_order=3),
    ])
    db.commit()

    # Topic Prerequisite (Asymptotic Analysis is prerequisite to Binary Search)
    db.add(TopicPrerequisite(topic_id=topic_bsearch.id, prerequisite_topic_id=topic_asymp.id))
    db.commit()

    # 5. Examination Syllabus Trees (Different structures demonstrating Section 2 & Test E)
    # UGC NET: Searching (Organizational) -> Binary Search
    org_ugc_searching = ExamSyllabusNode(
        exam_id=ugc_net.id,
        exam_subject_id=es_ugc_dsa.id,
        topic_id=None,
        title="Searching Algorithms",
        position_x=100.0,
        position_y=120.0,
        is_organizational=True
    )
    db.add(org_ugc_searching)
    db.commit()

    node_ugc_asymp = ExamSyllabusNode(
        exam_id=ugc_net.id,
        exam_subject_id=es_ugc_dsa.id,
        topic_id=topic_asymp.id,
        title="Asymptotic Analysis & Big-O",
        position_x=100.0,
        position_y=260.0,
        is_organizational=False
    )
    node_ugc_bsearch = ExamSyllabusNode(
        exam_id=ugc_net.id,
        exam_subject_id=es_ugc_dsa.id,
        topic_id=topic_bsearch.id,
        parent_node_id=org_ugc_searching.id,
        title="Binary Search",
        position_x=340.0,
        position_y=120.0,
        is_organizational=False
    )
    node_ugc_dp = ExamSyllabusNode(
        exam_id=ugc_net.id,
        exam_subject_id=es_ugc_dsa.id,
        topic_id=topic_dp.id,
        title="Dynamic Programming",
        position_x=340.0,
        position_y=260.0,
        is_organizational=False
    )
    db.add_all([node_ugc_asymp, node_ugc_bsearch, node_ugc_dp])
    db.commit()

    # GATE: Data Structures & Paradigms (Organizational) -> Divide and Conquer (Organizational) -> Binary Search
    org_gate_paradigms = ExamSyllabusNode(
        exam_id=gate_cs.id,
        exam_subject_id=es_gate_dsa.id,
        topic_id=None,
        title="Algorithm Paradigms",
        position_x=80.0,
        position_y=140.0,
        is_organizational=True
    )
    db.add(org_gate_paradigms)
    db.commit()

    org_gate_dnc = ExamSyllabusNode(
        exam_id=gate_cs.id,
        exam_subject_id=es_gate_dsa.id,
        parent_node_id=org_gate_paradigms.id,
        topic_id=None,
        title="Divide and Conquer",
        position_x=320.0,
        position_y=140.0,
        is_organizational=True
    )
    db.add(org_gate_dnc)
    db.commit()

    node_gate_bsearch = ExamSyllabusNode(
        exam_id=gate_cs.id,
        exam_subject_id=es_gate_dsa.id,
        parent_node_id=org_gate_dnc.id,
        topic_id=topic_bsearch.id,
        title="Binary Search",
        position_x=560.0,
        position_y=140.0,
        is_organizational=False
    )
    node_gate_asymp = ExamSyllabusNode(
        exam_id=gate_cs.id,
        exam_subject_id=es_gate_dsa.id,
        topic_id=topic_asymp.id,
        title="Asymptotic Analysis & Big-O",
        position_x=80.0,
        position_y=280.0,
        is_organizational=False
    )
    db.add_all([node_gate_bsearch, node_gate_asymp])
    db.commit()

    # 6. Preparation Records (Independent per exam)
    # UGC NET: Binary Search is Completed, 4 revisions, 4/5 confidence
    now = datetime.now(timezone.utc)
    prep_ugc_bsearch = TopicPreparation(
        exam_id=ugc_net.id,
        topic_id=topic_bsearch.id,
        status="completed",
        confidence_score=4,
        revision_count=4,
        last_revised_at=now - timedelta(days=2),
        next_revision_at=now + timedelta(days=12),
        personal_notes="UGC NET syllabus asks direct questions on time complexity and best case vs worst case comparisons.",
        actual_study_minutes=120
    )
    # GATE: Binary Search is Learning, 2 revisions, 3/5 confidence
    prep_gate_bsearch = TopicPreparation(
        exam_id=gate_cs.id,
        topic_id=topic_bsearch.id,
        status="learning",
        confidence_score=3,
        revision_count=2,
        last_revised_at=now - timedelta(days=5),
        next_revision_at=now + timedelta(days=2),
        personal_notes="GATE requires implementing lower_bound/upper_bound variations and search in rotated sorted array.",
        actual_study_minutes=90
    )
    # UGC NET: Asymptotic Analysis is reviewing
    prep_ugc_asymp = TopicPreparation(
        exam_id=ugc_net.id,
        topic_id=topic_asymp.id,
        status="reviewing",
        confidence_score=5,
        revision_count=3,
        last_revised_at=now - timedelta(days=1),
        next_revision_at=now + timedelta(days=14),
        personal_notes="Focus on master theorem edge cases.",
        actual_study_minutes=80
    )
    db.add_all([prep_ugc_bsearch, prep_gate_bsearch, prep_ugc_asymp])
    db.commit()

    # 7. Independent Revision Histories
    # 4 revisions for UGC NET Binary Search
    for i in range(1, 5):
        db.add(RevisionHistory(
            topic_preparation_id=prep_ugc_bsearch.id,
            revised_at=now - timedelta(days=15 - i * 3),
            revision_notes=f"UGC NET revision round {i}: solved 10 PYQs.",
            confidence_before=min(5, i),
            confidence_after=min(5, i + 1)
        ))
    # 2 revisions for GATE Binary Search
    for i in range(1, 3):
        db.add(RevisionHistory(
            topic_preparation_id=prep_gate_bsearch.id,
            revised_at=now - timedelta(days=10 - i * 4),
            revision_notes=f"GATE revision round {i}: solved search-space reduction problems.",
            confidence_before=i + 1,
            confidence_after=i + 2
        ))
    db.commit()
