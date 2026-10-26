# NEURO//TREE // Academic Knowledge Management & Cyberpunk Skill Tree

> **Personal academic knowledge management system with a Cyberpunk 2077 HUD-inspired interactive skill tree.**
> Decouples canonical reusable knowledge from examination-specific syllabus hierarchies and independent preparation/revision tracking.

---

## ⚡ Core Architecture

The system enforces a clean, normalized relational separation between 4 core domains:

1. **Canonical Knowledge Vault (`knowledge_topics`)**:
   - Universal concepts (e.g., *Binary Search*, *Dynamic Programming*).
   - Global explanations, definitions, algorithms, complexity analysis, prerequisites, difficulty, and priority.
   - Updating universal notes here immediately propagates to all examinations referencing the topic without duplication.

2. **Reusable Disciplines & Subjects (`subjects`, `exam_subjects`, `subject_topics`)**:
   - Academic subjects (e.g., *Data Structures and Algorithms*, *DBMS*).
   - Can be associated with multiple examinations simultaneously. Disassociating a subject from an exam never deletes canonical knowledge topics.

3. **Examination-Specific Syllabus Trees (`exam_syllabus_nodes`)**:
   - Represents the syllabus hierarchy specific to an exam (e.g. *Searching Algorithms* in UGC NET vs *Divide and Conquer* in GATE).
   - Each examination retains its own independent tree coordinates (`position_x`, `position_y`), parent-child groupings, and organizational branches.

4. **Independent Exam Preparation & Revision History (`topic_preparation`, `revision_history`)**:
   - Each examination maintains its own preparation status (`not_started`, `learning`, `reviewing`, `completed`), confidence score (1-5), and exam-specific notes (PYQs, tips).
   - Marking a topic as completed or revised in UGC NET **never** alters its status or revision count in GATE.
   - Discrete revision history events with before/after confidence ratings and spaced-repetition intervals.

---

## 🚀 Quick Start (Windows)

### 1. Run Automated Acceptance Tests
Double-click `run_tests.bat` or run:
```powershell
cd d:\skillTreeExam\backend
python -m pytest tests/test_acceptance.py -v
```

### 2. Start Backend Server
Double-click `run_backend.bat` or run:
```powershell
cd d:\skillTreeExam\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation available at: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 3. Start Frontend UI
Double-click `run_frontend.bat` or run:
```powershell
cd d:\skillTreeExam\frontend
npm run dev
```
Open your browser at: [http://localhost:5173](http://localhost:5173)

---

## 🧪 Acceptance Test Suite (Tests A through J)

All 10 required acceptance scenarios are automated in `backend/tests/test_acceptance.py`:

| Test | Scenario | Verified Behavior |
| :--- | :--- | :--- |
| **TEST A** | Shared Topic | Creates UGC NET, GATE, and a canonical topic. Verifies both examinations reference the exact same canonical topic ID. |
| **TEST B** | Independent Progress | Marks topic as `completed` in UGC NET and `learning` in GATE. Verifies statuses remain independent across refreshes. |
| **TEST C** | Independent Revision History | Records 3 revisions in UGC NET and 1 in GATE. Verifies revision counts and discrete revision logs are strictly isolated. |
| **TEST D** | Shared vs Isolated Notes | Updates universal notes (accessible in all exams), adds exam-specific PYQ notes in UGC NET (verified absent in GATE). |
| **TEST E** | Different Syllabus Structures | Places topic under "Searching" in UGC NET and under "Divide and Conquer" in GATE. Verifies distinct hierarchies without duplication. |
| **TEST F** | Subject Reuse | Associates subject with two exams, removes from one exam, verifies the other exam and knowledge base remain intact. |
| **TEST G** | Duplicate Detection | Detects existing canonical topic by name and offers interactive linking rather than silently duplicating. |
| **TEST H** | Tree Layout Persistence | Saves independent coordinate layouts for the same topic across exams and verifies persistence. |
| **TEST I** | Database Backup & Restore | Exports full relational snapshot and restores into clean database, verifying zero data loss. |
| **TEST J** | Deletion Safety | Warns when deleting a canonical topic used in multiple exams (HTTP 409) and requires explicit confirmation. |

---

## 🛠️ Tech Stack

- **Backend**: FastAPI, SQLAlchemy 2.0, SQLite (WAL mode, foreign keys enabled), Pydantic v2.
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React.
- **Visual Design**: Cyberpunk 2077 HUD aesthetic (Obsidian background `#07080c`, Neon Cyan `#00f0ff`, Neon Yellow `#fcee0a`, chamfered borders, circuit grids, and scanlines).
