import os
import sys
from redis import Redis
from rq import Queue, Worker


def main():
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    conn = Redis.from_url(redis_url)
    queue_name = os.getenv("QUEUE", "jobs")
    w = Worker([Queue(queue_name, connection=conn)], connection=conn)
    w.work(with_scheduler=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Worker failed: {e}", file=sys.stderr)
        raise

