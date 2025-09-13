FROM python:3.11-slim
WORKDIR /app
# Copy application code
COPY api /app/api
COPY solver /app/solver
COPY workers /app/workers
# Install worker/runtime deps (include numerics and API deps for importability)
RUN pip install --no-cache-dir -U pip && \
    pip install --no-cache-dir redis rq numpy scipy scikit-fem meshio ezdxf fastapi pydantic pydantic-settings python-multipart orjson
ENV PYTHONPATH=/app
CMD ["python", "/app/workers/worker.py"]
