"""
Celery application configuration.
"""
from celery import Celery

from .core.config import settings


broker_url = settings.CELERY_BROKER_URL or settings.REDIS_URL
result_backend = settings.CELERY_RESULT_BACKEND or settings.CELERY_BROKER_URL or settings.REDIS_URL

if not broker_url:
    broker_url = "redis://localhost:6379/0"
if not result_backend:
    result_backend = "redis://localhost:6379/1"

celery_app = Celery(
    "netzeal",
    broker=broker_url,
    backend=result_backend,
    include=["app.workers.feed_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_ignore_result=True,
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,
)
