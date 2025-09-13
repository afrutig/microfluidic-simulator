FROM python:3.11-slim
WORKDIR /app
# Install runtime dependencies directly
RUN pip install --no-cache-dir -U pip && \
    pip install --no-cache-dir fastapi "uvicorn[standard]" pydantic pydantic-settings python-multipart redis rq orjson ezdxf scikit-fem meshio numpy scipy
# Copy code into a proper package path
COPY app /app/api/app
ENV PYTHONPATH=/app
EXPOSE 8000
CMD ["uvicorn", "api.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
