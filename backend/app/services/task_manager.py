import asyncio
import logging
import threading
import time
from typing import Dict, List, Optional, Tuple

from backend.app.schemas.models import ProcessStatusEvent, StemResult

logger = logging.getLogger("walkouts.task_manager")


class TaskState:
    def __init__(self, task_id: str, track_id: Optional[str] = None):
        self.task_id = task_id
        self.track_id = track_id
        self.stage: str = "queued"
        self.progress: float = 0.0
        self.message: str = "Task initialized"
        self.result: Optional[StemResult] = None
        self.is_done: bool = False
        self.created_at: float = time.time()
        self.updated_at: float = time.time()
        self.subscribers: List[Tuple[asyncio.AbstractEventLoop, asyncio.Queue]] = []

    def to_event_dict(self) -> dict:
        return {
            "stage": self.stage,
            "progress": round(self.progress, 1),
            "message": self.message,
            "result": self.result.model_dump() if self.result else None,
        }

    def to_status_event(self) -> ProcessStatusEvent:
        return ProcessStatusEvent(
            stage=self.stage,
            progress=round(self.progress, 1),
            message=self.message,
            result=self.result,
        )


class TaskManager:
    """
    Thread-safe and async-aware task state manager for audio ingestion,
    background Demucs stem separation, and SSE event streaming.
    """

    def __init__(self):
        self._tasks: Dict[str, TaskState] = {}
        self._lock = threading.Lock()

    def create_task(self, task_id: str, track_id: Optional[str] = None) -> TaskState:
        with self._lock:
            task = TaskState(task_id=task_id, track_id=track_id)
            self._tasks[task_id] = task
            return task

    def get_task(self, task_id: str) -> Optional[TaskState]:
        with self._lock:
            return self._tasks.get(task_id)

    def get_task_by_track_id(self, track_id: str) -> Optional[TaskState]:
        with self._lock:
            for task in self._tasks.values():
                if task.track_id == track_id:
                    return task
            return None

    def update_task(
        self,
        task_id: str,
        stage: str,
        progress: float,
        message: str,
        result: Optional[StemResult] = None,
        track_id: Optional[str] = None,
    ) -> Optional[TaskState]:
        with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                task = TaskState(task_id=task_id, track_id=track_id)
                self._tasks[task_id] = task

            task.stage = stage
            task.progress = min(100.0, max(0.0, float(progress)))
            task.message = message
            task.updated_at = time.time()

            if track_id is not None:
                task.track_id = track_id

            if result is not None:
                task.result = result

            if stage in ("ready", "error"):
                task.is_done = True

            event_dict = task.to_event_dict()
            active_subs = list(task.subscribers)

        # Notify active SSE subscriber queues
        for loop, queue in active_subs:
            try:
                if loop.is_running():
                    loop.call_soon_threadsafe(queue.put_nowait, event_dict)
                else:
                    queue.put_nowait(event_dict)
            except Exception as e:
                logger.debug(f"Failed to dispatch event to subscriber queue for {task_id}: {e}")

        return task

    def subscribe(self, task_id: str) -> Tuple[asyncio.Queue, dict]:
        """
        Subscribe an asyncio queue to receive live SSE events for a task.
        Returns the queue and the current state event dict.
        """
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.get_event_loop()

        queue: asyncio.Queue = asyncio.Queue()

        with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                task = TaskState(task_id=task_id)
                self._tasks[task_id] = task

            task.subscribers.append((loop, queue))
            initial_event = task.to_event_dict()

        return queue, initial_event

    def unsubscribe(self, task_id: str, queue: asyncio.Queue):
        """Unsubscribe an asyncio queue from receiving events."""
        with self._lock:
            task = self._tasks.get(task_id)
            if task:
                task.subscribers = [
                    (loop, q) for loop, q in task.subscribers if q is not queue
                ]

    def clear(self):
        """Clear all tasks."""
        with self._lock:
            self._tasks.clear()


# Global singleton instance
task_manager = TaskManager()
