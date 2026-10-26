import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from app.models import ActivityHistory

def log_activity(
    db: Session,
    action_type: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    exam_id: Optional[str] = None,
    details: str = ""
):
    activity = ActivityHistory(
        id=str(uuid.uuid4()),
        action_type=action_type,
        entity_type=entity_type,
        entity_id=entity_id,
        exam_id=exam_id,
        details=details,
        created_at=datetime.now(timezone.utc)
    )
    db.add(activity)

def calculate_next_revision(confidence_score: int, revision_count: int, custom_interval_days: Optional[int] = None) -> datetime:
    """
    Spaced repetition interval calculator:
    Uses configurable interval or standard spaced intervals based on confidence (1-5) and revision count.
    Confidence 1: 1 day
    Confidence 2: 2 days
    Confidence 3: 4 days (or 3 * revision_count)
    Confidence 4: 7 days (or 5 * revision_count)
    Confidence 5: 14 days (or 10 * revision_count)
    """
    if custom_interval_days is not None and custom_interval_days > 0:
        days = custom_interval_days
    else:
        multiplier = max(1, revision_count)
        if confidence_score <= 1:
            days = 1
        elif confidence_score == 2:
            days = 2
        elif confidence_score == 3:
            days = min(30, 3 + multiplier)
        elif confidence_score == 4:
            days = min(60, 7 + (multiplier * 2))
        else: # 5
            days = min(90, 14 + (multiplier * 4))
    
    return datetime.now(timezone.utc) + timedelta(days=days)
