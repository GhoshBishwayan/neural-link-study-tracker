import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.seed import seed_database

# Create an isolated SQLite database for testing acceptance scenarios
TEST_DB_FILE = "test_neurotree_acceptance.db"
TEST_SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"

test_engine = create_engine(
    TEST_SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    seed_database(db)
    db.close()
    yield
    # Cleanup after test suite
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass

@pytest.fixture
def client():
    return TestClient(app)

# =====================================================================
# TEST A: SHARED TOPIC
# Create UGC NET and GATE.
# Create a DSA subject.
# Create a Binary Search topic.
# Associate it with both examinations.
# Verify that both examinations reference the same canonical topic ID.
# =====================================================================
def test_scenario_a_shared_topic(client):
    # 1. Create two new exams
    r_ugc = client.post("/api/examinations", json={"name": "Test Exam UGC NET", "description": "UGC CS"})
    assert r_ugc.status_code == 201
    ugc_id = r_ugc.json()["id"]

    r_gate = client.post("/api/examinations", json={"name": "Test Exam GATE", "description": "GATE CS"})
    assert r_gate.status_code == 201
    gate_id = r_gate.json()["id"]

    # 2. Create a DSA subject
    r_subj = client.post("/api/subjects", json={"name": "Algorithms & DS Test", "description": "Core CS"})
    assert r_subj.status_code == 201
    subj_id = r_subj.json()["id"]

    # Associate DSA with both examinations
    r_ugc_sub = client.post(f"/api/examinations/{ugc_id}/subjects", json={"subject_id": subj_id})
    assert r_ugc_sub.status_code == 201
    ugc_es_id = r_ugc_sub.json()["id"]

    r_gate_sub = client.post(f"/api/examinations/{gate_id}/subjects", json={"subject_id": subj_id})
    assert r_gate_sub.status_code == 201
    gate_es_id = r_gate_sub.json()["id"]

    # 3. Create a canonical Binary Search topic
    r_topic = client.post("/api/topics", json={
        "title": "Scenario A Binary Search",
        "description": "Logarithmic search on sorted arrays",
        "general_notes": "Canonical definition: O(log n)",
        "difficulty": 2,
        "priority": 4,
        "estimated_minutes": 60
    })
    assert r_topic.status_code == 201
    canonical_topic_id = r_topic.json()["id"]

    # 4. Associate it with both examinations' syllabus trees
    r_node_ugc = client.post(f"/api/examinations/{ugc_id}/syllabus/nodes", json={
        "exam_subject_id": ugc_es_id,
        "topic_id": canonical_topic_id,
        "title": "Binary Search"
    })
    assert r_node_ugc.status_code == 201
    ugc_node = r_node_ugc.json()

    r_node_gate = client.post(f"/api/examinations/{gate_id}/syllabus/nodes", json={
        "exam_subject_id": gate_es_id,
        "topic_id": canonical_topic_id,
        "title": "Binary Search"
    })
    assert r_node_gate.status_code == 201
    gate_node = r_node_gate.json()

    # 5. Verify that both examinations reference the EXACT SAME canonical topic ID
    assert ugc_node["topic_id"] == canonical_topic_id
    assert gate_node["topic_id"] == canonical_topic_id
    assert ugc_node["topic_id"] == gate_node["topic_id"]

    # Verify usage endpoint shows both exams
    r_usage = client.get(f"/api/topics/{canonical_topic_id}/usage")
    assert r_usage.status_code == 200
    used_exam_ids = [u["exam_id"] for u in r_usage.json()["used_in_exams"]]
    assert ugc_id in used_exam_ids
    assert gate_id in used_exam_ids


# =====================================================================
# TEST B: INDEPENDENT PROGRESS
# Mark Binary Search as completed for UGC NET.
# Leave it in progress / learning for GATE.
# Verify that the statuses remain independent after simulated refresh/reload.
# =====================================================================
def test_scenario_b_independent_progress(client):
    # Fetch seed exams
    exams = client.get("/api/examinations").json()
    ugc = next(e for e in exams if e["name"] == "UGC NET Computer Science")
    gate = next(e for e in exams if e["name"] == "GATE Computer Science")

    # Find canonical Binary Search topic
    topics = client.get("/api/topics?q=Binary Search").json()
    bsearch = next(t for t in topics if t["title"] == "Binary Search")
    bsearch_id = bsearch["id"]

    # 1. Update UGC NET preparation to completed
    r_ugc_prep = client.put(f"/api/examinations/{ugc['id']}/topics/{bsearch_id}/preparation", json={
        "status": "completed",
        "confidence_score": 5
    })
    assert r_ugc_prep.status_code == 200
    assert r_ugc_prep.json()["status"] == "completed"

    # 2. Update GATE preparation to learning
    r_gate_prep = client.put(f"/api/examinations/{gate['id']}/topics/{bsearch_id}/preparation", json={
        "status": "learning",
        "confidence_score": 2
    })
    assert r_gate_prep.status_code == 200
    assert r_gate_prep.json()["status"] == "learning"

    # 3. Simulate page reload / backend refresh by re-fetching via GET
    r_ugc_check = client.get(f"/api/examinations/{ugc['id']}/topics/{bsearch_id}/preparation")
    r_gate_check = client.get(f"/api/examinations/{gate['id']}/topics/{bsearch_id}/preparation")

    assert r_ugc_check.json()["status"] == "completed"
    assert r_ugc_check.json()["confidence_score"] == 5

    assert r_gate_check.json()["status"] == "learning"
    assert r_gate_check.json()["confidence_score"] == 2


# =====================================================================
# TEST C: INDEPENDENT REVISION HISTORY
# Record three revisions for UGC NET and one for GATE.
# Verify that the two preparation records and their revision histories remain independent.
# =====================================================================
def test_scenario_c_independent_revision_history(client):
    exams = client.get("/api/examinations").json()
    ugc = next(e for e in exams if e["name"] == "UGC NET Computer Science")
    gate = next(e for e in exams if e["name"] == "GATE Computer Science")

    # Create a fresh topic to test exact counts
    r_topic = client.post("/api/topics", json={"title": "Test C Topic", "difficulty": 1})
    topic_id = r_topic.json()["id"]

    # Link to UGC NET
    client.post(f"/api/examinations/{ugc['id']}/syllabus/nodes", json={"topic_id": topic_id})
    # Link to GATE
    client.post(f"/api/examinations/{gate['id']}/syllabus/nodes", json={"topic_id": topic_id})

    # Record 3 revisions for UGC NET
    for i in range(1, 4):
        r_rev = client.post(f"/api/examinations/{ugc['id']}/topics/{topic_id}/revisions", json={
            "revision_notes": f"UGC Rev #{i}",
            "confidence_before": i,
            "confidence_after": i + 1
        })
        assert r_rev.status_code == 201

    # Record 1 revision for GATE
    r_rev_gate = client.post(f"/api/examinations/{gate['id']}/topics/{topic_id}/revisions", json={
        "revision_notes": "GATE Rev #1",
        "confidence_before": 2,
        "confidence_after": 3
    })
    assert r_rev_gate.status_code == 201

    # Fetch revision histories
    ugc_revs = client.get(f"/api/examinations/{ugc['id']}/topics/{topic_id}/revisions").json()
    gate_revs = client.get(f"/api/examinations/{gate['id']}/topics/{topic_id}/revisions").json()

    assert len(ugc_revs) == 3
    assert len(gate_revs) == 1

    ugc_prep = client.get(f"/api/examinations/{ugc['id']}/topics/{topic_id}/preparation").json()
    gate_prep = client.get(f"/api/examinations/{gate['id']}/topics/{topic_id}/preparation").json()

    assert ugc_prep["revision_count"] == 3
    assert gate_prep["revision_count"] == 1


# =====================================================================
# TEST D: SHARED NOTES VS EXAM-SPECIFIC NOTES
# Add general Binary Search notes. Verify both examinations can access them.
# Add UGC NET-specific notes. Verify they do not appear in GATE.
# =====================================================================
def test_scenario_d_shared_vs_isolated_notes(client):
    exams = client.get("/api/examinations").json()
    ugc = next(e for e in exams if e["name"] == "UGC NET Computer Science")
    gate = next(e for e in exams if e["name"] == "GATE Computer Science")

    topics = client.get("/api/topics?q=Binary Search").json()
    bsearch = next(t for t in topics if t["title"] == "Binary Search")
    topic_id = bsearch["id"]

    # 1. Update shared canonical knowledge notes
    shared_text = "GLOBAL NOTES: Binary Search requires random access and a sorted container."
    client.put(f"/api/topics/{topic_id}", json={"general_notes": shared_text})

    # Verify both syllabus nodes access the exact same shared notes
    ugc_nodes = client.get(f"/api/examinations/{ugc['id']}/syllabus").json()
    gate_nodes = client.get(f"/api/examinations/{gate['id']}/syllabus").json()

    ugc_bsearch_node = next(n for n in ugc_nodes if n.get("topic") and n["topic"]["id"] == topic_id)
    gate_bsearch_node = next(n for n in gate_nodes if n.get("topic") and n["topic"]["id"] == topic_id)

    assert ugc_bsearch_node["topic"]["general_notes"] == shared_text
    assert gate_bsearch_node["topic"]["general_notes"] == shared_text

    # 2. Add UGC NET-specific notes in topic_preparation
    ugc_personal = "UGC ONLY NOTE: Focus on paper 2 recurrence relation questions."
    client.put(f"/api/examinations/{ugc['id']}/topics/{topic_id}/preparation", json={
        "personal_notes": ugc_personal
    })

    # 3. Add GATE-specific notes
    gate_personal = "GATE ONLY NOTE: Check time complexity of exponential search variation."
    client.put(f"/api/examinations/{gate['id']}/topics/{topic_id}/preparation", json={
        "personal_notes": gate_personal
    })

    # Verify isolation
    ugc_prep = client.get(f"/api/examinations/{ugc['id']}/topics/{topic_id}/preparation").json()
    gate_prep = client.get(f"/api/examinations/{gate['id']}/topics/{topic_id}/preparation").json()

    assert ugc_prep["personal_notes"] == ugc_personal
    assert gate_prep["personal_notes"] == gate_personal
    assert ugc_personal not in gate_prep["personal_notes"]
    assert gate_personal not in ugc_prep["personal_notes"]


# =====================================================================
# TEST E: DIFFERENT SYLLABUS STRUCTURES
# Place Binary Search under "Searching" in UGC NET.
# Place the same topic under "Data Structures" in GATE.
# Verify that both syllabus hierarchies remain valid and topic is not duplicated.
# =====================================================================
def test_scenario_e_different_syllabus_structures(client):
    # Create test exam 1
    ex1 = client.post("/api/examinations", json={"name": "Struct Test UGC"}).json()
    # Create test exam 2
    ex2 = client.post("/api/examinations", json={"name": "Struct Test GATE"}).json()

    # Create canonical topic
    t = client.post("/api/topics", json={"title": "Shared Struct Topic"}).json()
    t_id = t["id"]

    # Exam 1 hierarchy: "Searching" (org) -> Shared Struct Topic
    org1 = client.post(f"/api/examinations/{ex1['id']}/syllabus/nodes", json={
        "title": "Searching Branch",
        "is_organizational": True
    }).json()

    node1 = client.post(f"/api/examinations/{ex1['id']}/syllabus/nodes", json={
        "topic_id": t_id,
        "parent_node_id": org1["id"],
        "title": "Binary Search"
    }).json()

    # Exam 2 hierarchy: "Data Structures" (org) -> Shared Struct Topic
    org2 = client.post(f"/api/examinations/{ex2['id']}/syllabus/nodes", json={
        "title": "Data Structures Branch",
        "is_organizational": True
    }).json()

    node2 = client.post(f"/api/examinations/{ex2['id']}/syllabus/nodes", json={
        "topic_id": t_id,
        "parent_node_id": org2["id"],
        "title": "Binary Search"
    }).json()

    # Verify hierarchies
    assert node1["parent_node_id"] == org1["id"]
    assert node2["parent_node_id"] == org2["id"]
    assert node1["parent_node_id"] != node2["parent_node_id"]

    # Verify both reference the SAME canonical topic ID
    assert node1["topic_id"] == t_id
    assert node2["topic_id"] == t_id


# =====================================================================
# TEST F: SUBJECT REUSE
# Associate DSA with two examinations.
# Remove it from one examination.
# Verify that the other examination and the knowledge base remain intact.
# =====================================================================
def test_scenario_f_subject_reuse(client):
    exA = client.post("/api/examinations", json={"name": "Exam Alpha"}).json()
    exB = client.post("/api/examinations", json={"name": "Exam Beta"}).json()
    subj = client.post("/api/subjects", json={"name": "Reusable Math"}).json()

    # Associate with both
    client.post(f"/api/examinations/{exA['id']}/subjects", json={"subject_id": subj["id"]})
    client.post(f"/api/examinations/{exB['id']}/subjects", json={"subject_id": subj["id"]})

    # Remove from Exam Alpha
    r_del = client.delete(f"/api/examinations/{exA['id']}/subjects/{subj['id']}")
    assert r_del.status_code == 204

    # Verify Exam Alpha no longer has it
    subsA = client.get(f"/api/examinations/{exA['id']}/subjects").json()
    assert not any(s["subject_id"] == subj["id"] for s in subsA)

    # Verify Exam Beta STILL has it
    subsB = client.get(f"/api/examinations/{exB['id']}/subjects").json()
    assert any(s["subject_id"] == subj["id"] for s in subsB)

    # Verify subject STILL exists in knowledge base
    subj_check = client.get(f"/api/subjects/{subj['id']}")
    assert subj_check.status_code == 200
    assert subj_check.json()["name"] == "Reusable Math"


# =====================================================================
# TEST G: DUPLICATE DETECTION
# Attempt to create/link a topic that already exists.
# Verify that the application offers the existing topic instead of silently creating a duplicate.
# =====================================================================
def test_scenario_g_duplicate_detection(client):
    client.post("/api/topics", json={"title": "Dynamic Programming Masterclass"})

    # Check duplicate detection endpoint
    r_check = client.get("/api/topics/check-duplicate?title=Dynamic Programming Masterclass")
    assert r_check.status_code == 200
    data = r_check.json()

    assert data["exact_match"] is not None
    assert data["exact_match"]["title"] == "Dynamic Programming Masterclass"
    assert data["exact_match"]["similarity_score"] == 1.0

    # Also test fuzzy check
    r_fuzzy = client.get("/api/topics/check-duplicate?title=Dynamic Programming")
    assert r_fuzzy.status_code == 200
    fuzzy_data = r_fuzzy.json()
    assert len(fuzzy_data["similar_matches"]) > 0


# =====================================================================
# TEST H: TREE LAYOUT PERSISTENCE
# Arrange the topic differently in each examination tree.
# Refresh / re-query. Verify each examination retains its own layout.
# =====================================================================
def test_scenario_h_tree_layout_persistence(client):
    ex1 = client.post("/api/examinations", json={"name": "Layout Exam 1"}).json()
    ex2 = client.post("/api/examinations", json={"name": "Layout Exam 2"}).json()

    t = client.post("/api/topics", json={"title": "Layout Test Topic"}).json()

    n1 = client.post(f"/api/examinations/{ex1['id']}/syllabus/nodes", json={
        "topic_id": t["id"],
        "position_x": 120.0,
        "position_y": 240.0
    }).json()

    n2 = client.post(f"/api/examinations/{ex2['id']}/syllabus/nodes", json={
        "topic_id": t["id"],
        "position_x": 800.0,
        "position_y": 600.0
    }).json()

    # Re-query
    nodes1 = client.get(f"/api/examinations/{ex1['id']}/syllabus").json()
    nodes2 = client.get(f"/api/examinations/{ex2['id']}/syllabus").json()

    node1_saved = next(n for n in nodes1 if n["id"] == n1["id"])
    node2_saved = next(n for n in nodes2 if n["id"] == n2["id"])

    assert node1_saved["position_x"] == 120.0
    assert node1_saved["position_y"] == 240.0

    assert node2_saved["position_x"] == 800.0
    assert node2_saved["position_y"] == 600.0


# =====================================================================
# TEST I: DATABASE BACKUP AND RESTORE
# Create shared topics, examination-specific preparation records, and revision history.
# Export a complete backup and restore it into a clean database.
# Verify that all relationships and records remain intact.
# =====================================================================
def test_scenario_i_database_backup_and_restore(client):
    # 1. Export full database
    r_exp = client.get("/api/backup/export-full")
    assert r_exp.status_code == 200
    backup_data = r_exp.json()

    assert len(backup_data["examinations"]) > 0
    assert len(backup_data["knowledge_topics"]) > 0
    assert len(backup_data["topic_preparations"]) > 0

    # 2. Restore into database
    r_restore = client.post("/api/backup/restore-full", json=backup_data)
    assert r_restore.status_code == 200

    # 3. Verify all restored records
    r_exams = client.get("/api/examinations")
    assert len(r_exams.json()) == len(backup_data["examinations"])

    r_topics = client.get("/api/topics")
    assert len(r_topics.json()) == len(backup_data["knowledge_topics"])


# =====================================================================
# TEST J: DELETION SAFETY
# Attempt to delete a canonical topic used by multiple examinations.
# Explain consequences and require confirmation.
# Do not accidentally delete unrelated examination data.
# =====================================================================
def test_scenario_j_deletion_safety(client):
    # Find topic used in multiple exams (Binary Search)
    topics = client.get("/api/topics?q=Binary Search").json()
    bsearch = next(t for t in topics if t["title"] == "Binary Search")
    topic_id = bsearch["id"]

    # 1. Attempt to delete without force -> must fail with 409 Conflict
    r_del = client.delete(f"/api/topics/{topic_id}")
    assert r_del.status_code == 409
    err = r_del.json()["detail"]
    assert err["requires_confirmation"] is True
    assert len(err["used_in_exams"]) > 1

    # Verify topic is STILL intact
    r_check = client.get(f"/api/topics/{topic_id}")
    assert r_check.status_code == 200

    # 2. Deleting with force=True should succeed
    r_force = client.delete(f"/api/topics/{topic_id}?force=true")
    assert r_force.status_code == 200

    # Verify topic is now deleted
    r_after = client.get(f"/api/topics/{topic_id}")
    assert r_after.status_code == 404
