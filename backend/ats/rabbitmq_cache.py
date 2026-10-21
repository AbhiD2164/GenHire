"""
RabbitMQ Runtime Suggestions & Caching Service.
Uses RabbitMQ message queue with intelligent in-memory cache fallback.
Provides real-time runtime suggestions based on resume evaluation.
"""
import json
import logging
import threading
from datetime import datetime, timedelta
from django.conf import settings

logger = logging.getLogger(__name__)

# Thread-safe in-memory cache
_SUGGESTION_CACHE = {}
_CACHE_LOCK = threading.Lock()
_CACHE_EXPIRY_MINUTES = 60


def _get_cache_key(user_id: int) -> str:
    return f"user_suggestions_{user_id}"


def get_cached_suggestions(user_id: int):
    with _CACHE_LOCK:
        entry = _SUGGESTION_CACHE.get(_get_cache_key(user_id))
        if entry:
            expires_at, data = entry
            if datetime.now() < expires_at:
                return data
            else:
                del _SUGGESTION_CACHE[_get_cache_key(user_id)]
    return None


def set_cached_suggestions(user_id: int, suggestions: list):
    with _CACHE_LOCK:
        expires_at = datetime.now() + timedelta(minutes=_CACHE_EXPIRY_MINUTES)
        _SUGGESTION_CACHE[_get_cache_key(user_id)] = (expires_at, suggestions)


def publish_rabbitmq_event(event_type: str, payload: dict):
    """
    Publishes an event to RabbitMQ queue.
    If RabbitMQ is unavailable or offline, logs and gracefully falls back.
    """
    if not getattr(settings, "RABBITMQ_ENABLED", True):
        return False

    def _publish_worker():
        try:
            import pika
            queue_name = getattr(settings, "RABBITMQ_SUGGESTION_QUEUE", "genhire_job_suggestions")
            amqp_url = getattr(settings, "RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
            params = pika.URLParameters(amqp_url)
            params.socket_timeout = 2

            connection = pika.BlockingConnection(params)
            channel = connection.channel()
            channel.queue_declare(queue=queue_name, durable=True)

            message = json.dumps({"event": event_type, "timestamp": datetime.now().isoformat(), "payload": payload})
            channel.basic_publish(
                exchange="",
                routing_key=queue_name,
                body=message,
                properties=pika.BasicProperties(delivery_mode=2),
            )
            connection.close()
            return True
        except Exception as exc:
            # RabbitMQ daemon may not be active; fallback gracefully
            logger.debug(f"RabbitMQ event dispatch bypassed: {exc}")
            return False

    # Dispatch non-blocking in background thread
    t = threading.Thread(target=_publish_worker, daemon=True)
    t.start()
    return True


def compute_runtime_suggestions(user, applied_job=None, resume_score=None, extracted_skills=None):
    """
    Computes runtime suggestions based on criteria:
    - If user applied for a job role and has a perfect/matching resume (score >= 0.60):
      Suggest jobs similar to their profile and the applied role.
    - If not (score < 0.60 or rejected):
      Suggest matching job profiles tailored directly from their resume skills.
    """
    from jobs.models import Job

    # User's skills
    user_skills_list = []
    if extracted_skills:
        if isinstance(extracted_skills, list):
            user_skills_list = [s.strip().lower() for s in extracted_skills if s.strip()]
        else:
            user_skills_list = [s.strip().lower() for s in str(extracted_skills).split(",") if s.strip()]
    elif hasattr(user, "profile") and user.profile.skills:
        user_skills_list = [s.strip().lower() for s in user.profile.skills.split(",") if s.strip()]

    user_skills_set = set(user_skills_list)

    # All active jobs (excluding already applied jobs or the exact applied job)
    applied_job_ids = list(user.applications.values_list("job_id", flat=True)) if hasattr(user, "applications") else []
    active_jobs = Job.objects.filter(is_active=True).exclude(id__in=applied_job_ids)

    suggestions = []
    is_matching = (resume_score is not None and resume_score >= 0.60)

    if is_matching and applied_job:
        # Match type 1: User has a strong/matching resume for the applied job
        # Suggest jobs similar to their profile and applied role (same industry, similar skills, work mode)
        for job in active_jobs:
            job_skills = [s.strip().lower() for s in job.skills_required.split(",") if s.strip()]
            overlap = len(set(job_skills) & user_skills_set)
            is_same_industry = (job.industry == applied_job.industry)
            score = round((overlap / max(1, len(job_skills)) * 0.7) + (0.3 if is_same_industry else 0.1), 2)

            if score > 0.2:
                suggestions.append({
                    "id": job.id,
                    "title": job.title,
                    "company_name": job.company_name,
                    "location": job.location,
                    "work_mode": job.work_mode,
                    "industry": job.industry,
                    "match_type": "similar_to_profile",
                    "match_score": min(1.0, score),
                    "reason": f"Similar role to your application for {applied_job.title} ({job.company_name}) matching your profile.",
                    "matched_skills": list(set(job_skills) & user_skills_set),
                })
    else:
        # Match type 2: User didn't match the applied role, OR exploring suggestions
        # Suggest matching job profiles directly from their resume skills
        for job in active_jobs:
            job_skills = [s.strip().lower() for s in job.skills_required.split(",") if s.strip()]
            overlap = len(set(job_skills) & user_skills_set)
            overlap_skills = list(set(job_skills) & user_skills_set)

            if overlap > 0:
                score = round(overlap / max(1, len(job_skills)), 2)
                suggestions.append({
                    "id": job.id,
                    "title": job.title,
                    "company_name": job.company_name,
                    "location": job.location,
                    "work_mode": job.work_mode,
                    "industry": job.industry,
                    "match_type": "matching_resume_skills",
                    "match_score": min(1.0, score),
                    "reason": f"Matches your resume skills: {', '.join(overlap_skills[:4])}.",
                    "matched_skills": overlap_skills,
                })

    # Sort suggestions by match_score descending
    suggestions.sort(key=lambda x: x["match_score"], reverse=True)
    top_suggestions = suggestions[:12]

    # Save to cache
    set_cached_suggestions(user.id, top_suggestions)

    # Publish to RabbitMQ
    publish_rabbitmq_event("runtime_suggestions_updated", {
        "user_id": user.id,
        "count": len(top_suggestions),
        "applied_job_id": applied_job.id if applied_job else None,
        "is_matching": is_matching,
    })

    return top_suggestions
