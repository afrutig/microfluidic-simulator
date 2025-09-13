// Auto-generated placeholder for OpenAPI client types.
// Generate real types with: npm run gen:api (requires API running at /openapi.json)

export namespace components {
  export namespace schemas {
    export interface JobSpec {
      name: string;
      geometry: { width: number; height: number };
      material: { density: number; viscosity: number; diffusivity: number };
      boundaries: { type: string; value?: number | null }[];
      solve_transport?: boolean;
    }
    export interface JobStatus {
      id: string;
      status: string;
      progress?: number | null;
      error?: string | null;
    }
  }
}
