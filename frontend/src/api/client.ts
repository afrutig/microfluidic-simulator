import type * as OpenAPI from "./generated";

export type JobSpec = OpenAPI.components.schemas.JobSpec;
export type JobStatus = OpenAPI.components.schemas.JobStatus;

// Prefer relative '/api' for local dev proxy; fall back to explicit base URL
export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function createJob(spec: JobSpec): Promise<JobStatus> {
  const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec),
  });
  return json<JobStatus>(res);
}

export async function getJob(id: string): Promise<JobStatus> {
  const res = await fetch(`${BASE_URL}/api/v1/jobs/${id}`);
  return json<JobStatus>(res);
}

export async function getJobResult(id: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/v1/jobs/${id}/result`);
  return json<any>(res);
}

export async function listArtifacts(
  id: string,
): Promise<{ artifacts: { name: string; size: number; url: string }[] }> {
  const res = await fetch(`${BASE_URL}/api/v1/jobs/${id}/artifacts`);
  return json(res);
}

export function artifactDownloadUrl(id: string, name: string): string {
  return `${BASE_URL}/api/v1/jobs/${id}/download/${encodeURIComponent(name)}`;
}

// Projects API
export type Project = { id: string; name: string; data: any };

export async function listProjects(): Promise<Project[]> {
  const res = await fetch(`${BASE_URL}/api/v1/projects`);
  return json(res);
}

export async function createProject(name: string, data: any): Promise<Project> {
  const res = await fetch(`${BASE_URL}/api/v1/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, data }),
  });
  return json(res);
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`${BASE_URL}/api/v1/projects/${id}`);
  return json(res);
}

export async function updateProject(
  id: string,
  name: string,
  data: any,
): Promise<Project> {
  const res = await fetch(`${BASE_URL}/api/v1/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, data }),
  });
  return json(res);
}

export async function deleteProject(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE_URL}/api/v1/projects/${id}`, {
    method: "DELETE",
  });
  return json(res);
}
