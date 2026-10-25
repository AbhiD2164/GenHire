"""Publishes runtime-suggestion events and computes personalized job matches."""
import json
import logging
import threading
from django.conf import settings

logger = logging.getLogger(__name__)

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


def compute_runtime_suggestions(user):
    """Rank un-applied jobs with trained decisions or an explicit content fallback."""
    applied_job_ids = list(user.applications.values_list("job_id", flat=True))
    from .recommender import get_recommender

    suggestions = get_recommender().recommend_for_user(
        user, top_k=12, exclude_job_ids=applied_job_ids
    )

    publish_rabbitmq_event("runtime_suggestions_updated", {
        "user_id": user.id,
        "count": len(suggestions),
        "recommendation_method": (
            suggestions[0]["recommendation_method"] if suggestions else "none"
        ),
    })

    return suggestions
