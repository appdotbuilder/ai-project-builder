import { z } from 'zod';

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  name: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// User registration input schema
export const registerUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1)
});

export type RegisterUserInput = z.infer<typeof registerUserInputSchema>;

// User login input schema
export const loginUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginUserInput = z.infer<typeof loginUserInputSchema>;

// Project schema
export const projectSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  user_id: z.number(),
  metadata: z.record(z.any()).nullable(), // Flexible JSON structure for additional project data
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Project = z.infer<typeof projectSchema>;

// Create project input schema
export const createProjectInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  user_id: z.number(),
  metadata: z.record(z.any()).optional()
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

// Update project input schema
export const updateProjectInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  metadata: z.record(z.any()).nullable().optional()
});

export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;

// Project file schema - represents files within a project's codebase
export const projectFileSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  path: z.string(), // File path within the project (e.g., /src/index.ts)
  content: z.string(), // File content
  file_type: z.enum(['file', 'directory']),
  parent_id: z.number().nullable(), // For hierarchical file structure
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type ProjectFile = z.infer<typeof projectFileSchema>;

// Create project file input schema
export const createProjectFileInputSchema = z.object({
  project_id: z.number(),
  path: z.string(),
  content: z.string(),
  file_type: z.enum(['file', 'directory']),
  parent_id: z.number().nullable()
});

export type CreateProjectFileInput = z.infer<typeof createProjectFileInputSchema>;

// Update project file input schema
export const updateProjectFileInputSchema = z.object({
  id: z.number(),
  path: z.string().optional(),
  content: z.string().optional(),
  file_type: z.enum(['file', 'directory']).optional(),
  parent_id: z.number().nullable().optional()
});

export type UpdateProjectFileInput = z.infer<typeof updateProjectFileInputSchema>;

// Authentication response schema
export const authResponseSchema = z.object({
  user: userSchema,
  token: z.string()
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

// Project with files schema (for detailed project view)
export const projectWithFilesSchema = z.object({
  project: projectSchema,
  files: z.array(projectFileSchema)
});

export type ProjectWithFiles = z.infer<typeof projectWithFilesSchema>;

// AI generation request schema (placeholder for future implementation)
export const aiGenerationRequestSchema = z.object({
  project_id: z.number(),
  prompt: z.string(),
  file_path: z.string().optional(),
  generation_type: z.enum(['file', 'component', 'feature', 'full_app'])
});

export type AiGenerationRequest = z.infer<typeof aiGenerationRequestSchema>;

// Deployment request schema (placeholder for future implementation)
export const deploymentRequestSchema = z.object({
  project_id: z.number(),
  deployment_config: z.record(z.any()).optional(),
  environment: z.enum(['development', 'staging', 'production'])
});

export type DeploymentRequest = z.infer<typeof deploymentRequestSchema>;