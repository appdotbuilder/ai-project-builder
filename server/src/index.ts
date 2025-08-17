import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  registerUserInputSchema,
  loginUserInputSchema,
  createProjectInputSchema,
  updateProjectInputSchema,
  createProjectFileInputSchema,
  updateProjectFileInputSchema,
  aiGenerationRequestSchema,
  deploymentRequestSchema
} from './schema';

// Import handlers
import { registerUser } from './handlers/register_user';
import { loginUser } from './handlers/login_user';
import { createProject } from './handlers/create_project';
import { getProjects } from './handlers/get_projects';
import { getProjectById } from './handlers/get_project_by_id';
import { updateProject } from './handlers/update_project';
import { deleteProject } from './handlers/delete_project';
import { createProjectFile } from './handlers/create_project_file';
import { getProjectFiles } from './handlers/get_project_files';
import { getProjectFileById } from './handlers/get_project_file_by_id';
import { updateProjectFile } from './handlers/update_project_file';
import { deleteProjectFile } from './handlers/delete_project_file';
import { getProjectWithFiles } from './handlers/get_project_with_files';
import { generateWithAi } from './handlers/generate_with_ai';
import { deployProject } from './handlers/deploy_project';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

// For now, we'll use a simple user ID parameter for authenticated procedures
// In a real implementation, this would use JWT middleware for authentication
const authenticatedProcedure = publicProcedure.input(z.object({
  userId: z.number()
}));

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  registerUser: publicProcedure
    .input(registerUserInputSchema)
    .mutation(({ input }) => registerUser(input)),

  loginUser: publicProcedure
    .input(loginUserInputSchema)
    .mutation(({ input }) => loginUser(input)),

  // Project management routes
  createProject: publicProcedure
    .input(createProjectInputSchema)
    .mutation(({ input }) => createProject(input)),

  getProjects: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getProjects(input.userId)),

  getProjectById: publicProcedure
    .input(z.object({ projectId: z.number(), userId: z.number() }))
    .query(({ input }) => getProjectById(input.projectId, input.userId)),

  updateProject: publicProcedure
    .input(updateProjectInputSchema.extend({ userId: z.number() }))
    .mutation(({ input }) => {
      const { userId, ...projectInput } = input;
      return updateProject(projectInput, userId);
    }),

  deleteProject: publicProcedure
    .input(z.object({ projectId: z.number(), userId: z.number() }))
    .mutation(({ input }) => deleteProject(input.projectId, input.userId)),

  // Project file management routes
  createProjectFile: publicProcedure
    .input(createProjectFileInputSchema.extend({ userId: z.number() }))
    .mutation(({ input }) => {
      const { userId, ...fileInput } = input;
      return createProjectFile(fileInput, userId);
    }),

  getProjectFiles: publicProcedure
    .input(z.object({ projectId: z.number(), userId: z.number() }))
    .query(({ input }) => getProjectFiles(input.projectId, input.userId)),

  getProjectFileById: publicProcedure
    .input(z.object({ fileId: z.number(), userId: z.number() }))
    .query(({ input }) => getProjectFileById(input.fileId, input.userId)),

  updateProjectFile: publicProcedure
    .input(updateProjectFileInputSchema.extend({ userId: z.number() }))
    .mutation(({ input }) => {
      const { userId, ...fileInput } = input;
      return updateProjectFile(fileInput, userId);
    }),

  deleteProjectFile: publicProcedure
    .input(z.object({ fileId: z.number(), userId: z.number() }))
    .mutation(({ input }) => deleteProjectFile(input.fileId, input.userId)),

  getProjectWithFiles: publicProcedure
    .input(z.object({ projectId: z.number(), userId: z.number() }))
    .query(({ input }) => getProjectWithFiles(input.projectId, input.userId)),

  // AI and deployment routes (placeholder functionality)
  generateWithAi: publicProcedure
    .input(aiGenerationRequestSchema.extend({ userId: z.number() }))
    .mutation(({ input }) => {
      const { userId, ...aiInput } = input;
      return generateWithAi(aiInput, userId);
    }),

  deployProject: publicProcedure
    .input(deploymentRequestSchema.extend({ userId: z.number() }))
    .mutation(({ input }) => {
      const { userId, ...deployInput } = input;
      return deployProject(deployInput, userId);
    }),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();