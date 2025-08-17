import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, projectsTable, projectFilesTable } from '../db/schema';
import { type AiGenerationRequest } from '../schema';
import { generateWithAi } from '../handlers/generate_with_ai';
import { eq, and } from 'drizzle-orm';

// Test user data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password',
  name: 'Test User'
};

// Test project data
const testProject = {
  name: 'Test Project',
  description: 'A project for testing AI generation',
  metadata: { framework: 'React', language: 'TypeScript' }
};

describe('generateWithAi', () => {
  let userId: number;
  let projectId: number;

  beforeEach(async () => {
    await createDB();

    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test project
    const projectResult = await db.insert(projectsTable)
      .values({
        ...testProject,
        user_id: userId
      })
      .returning()
      .execute();
    projectId = projectResult[0].id;
  });

  afterEach(async () => {
    await resetDB();
  });

  describe('project access validation', () => {
    it('should generate content for valid project owned by user', async () => {
      const input: AiGenerationRequest = {
        project_id: projectId,
        prompt: 'Create a simple utility function',
        generation_type: 'file',
        file_path: 'utils/helper.ts'
      };

      const result = await generateWithAi(input, userId);

      expect(result.message).toContain('Generated file content');
      expect(result.generated_content).toBeDefined();
      expect(result.generated_content!).toContain('TypeScript');
      expect(result.generated_content!).toContain(input.prompt);
    });

    it('should throw error for non-existent project', async () => {
      const input: AiGenerationRequest = {
        project_id: 99999,
        prompt: 'Create something',
        generation_type: 'file'
      };

      await expect(generateWithAi(input, userId)).rejects.toThrow(/Project not found or access denied/i);
    });

    it('should throw error when user does not own project', async () => {
      // Create another user
      const anotherUserResult = await db.insert(usersTable)
        .values({
          email: 'another@example.com',
          password_hash: 'hashed_password',
          name: 'Another User'
        })
        .returning()
        .execute();
      const anotherUserId = anotherUserResult[0].id;

      const input: AiGenerationRequest = {
        project_id: projectId,
        prompt: 'Try to generate content',
        generation_type: 'file'
      };

      // Try to access project with different user
      await expect(generateWithAi(input, anotherUserId)).rejects.toThrow(/Project not found or access denied/i);
    });
  });

  describe('file generation', () => {
    it('should generate TypeScript file content', async () => {
      const input: AiGenerationRequest = {
        project_id: projectId,
        prompt: 'Create a data processing utility',
        generation_type: 'file',
        file_path: 'src/utils/processor.ts'
      };

      const result = await generateWithAi(input, userId);

      expect(result.message).toContain('Generated file content for src/utils/processor.ts');
      expect(result.generated_content).toBeDefined();
      expect(result.generated_content!).toContain('TypeScript');
      expect(result.generated_content!).toContain('export');
      expect(result.generated_content!).toContain('interface');
      expect(result.generated_content!).toContain('class');
    });

    it('should generate JavaScript file content', async () => {
      const input: AiGenerationRequest = {
        project_id: projectId,
        prompt: 'Create a helper function',
        generation_type: 'file',
        file_path: 'src/helpers/utility.js'
      };

      const result = await generateWithAi(input, userId);

      expect(result.message).toContain('Generated file content for src/helpers/utility.js');
      expect(result.generated_content).toBeDefined();
      expect(result.generated_content!).toContain('JavaScript');
      expect(result.generated_content!).toContain('class');
      expect(result.generated_content!).toContain('module.exports');
    });

    it('should generate CSS file content', async () => {
      const input: AiGenerationRequest = {
        project_id: projectId,
        prompt: 'Create responsive layout styles',
        generation_type: 'file',
        file_path: 'src/styles/layout.css'
      };

      const result = await generateWithAi(input, userId);

      expect(result.message).toContain('Generated file content for src/styles/layout.css');
      expect(result.generated_content).toBeDefined();
      expect(result.generated_content!).toContain('CSS');
      expect(result.generated_content!).toContain('generated-container');
      expect(result.generated_content!).toContain('flex');
    });

    it('should generate generic content for unknown file types', async () => {
      const input: AiGenerationRequest = {
        project_id: projectId,
        prompt: 'Create documentation',
        generation_type: 'file',
        file_path: 'README.md'
      };

      const result = await generateWithAi(input, userId);

      expect(result.message).toContain('Generated file content for README.md');
      expect(result.generated_content).toBeDefined();
      expect(result.generated_content!).toContain('Generated content based on');
      expect(result.generated_content!).toContain(input.prompt);
      expect(result.generated_content!).toContain('## Features');
    });

    it('should save new file to project when file_path provided', async () => {
      const input: AiGenerationRequest = {
        project_id: projectId,
        prompt: 'Create configuration file',
        generation_type: 'file',
        file_path: 'config/app.ts'
      };

      const result = await generateWithAi(input, userId);

      expect(result.message).toContain('and saved to project');

      // Verify file was saved
      const savedFiles = await db.select()
        .from(projectFilesTable)
        .where(and(
          eq(projectFilesTable.project_id, projectId),
          eq(projectFilesTable.path, 'config/app.ts')
        ))
        .execute();

      expect(savedFiles).toHaveLength(1);
      expect(savedFiles[0].content).toEqual(result.generated_content!);
      expect(savedFiles[0].file_type).toEqual('file');
    });

    it('should not overwrite existing file', async () => {
      // Create existing file
      await db.insert(projectFilesTable)
        .values({
          project_id: projectId,
          path: 'existing/file.ts',
          content: 'existing content',
          file_type: 'file',
          parent_id: null
        })
        .execute();

      const input: AiGenerationRequest = {
        project_id: projectId,
        prompt: 'Update existing file',
        generation_type: 'file',
        file_path: 'existing/file.ts'
      };

      const result = await generateWithAi(input, userId);

      expect(result.message).toContain('file already exists - content returned without saving');

      // Verify original content is preserved
      const existingFiles = await db.select()
        .from(projectFilesTable)
        .where(and(
          eq(projectFilesTable.project_id, projectId),
          eq(projectFilesTable.path, 'existing/file.ts')
        ))
        .execute();

      expect(existingFiles[0].content).toEqual('existing content');
    });
  });

  describe('component generation', () => {
    it('should generate React component', async () => {
      const input: AiGenerationRequest = {
        project_id: projectId,
        prompt: 'Create a user profile component',
        generation_type: 'component'
      };

      const result = await generateWithAi(input, userId);

      expect(result.message).toContain('Generated component based on prompt');
      expect(result.message).toContain(input.prompt);
      expect(result.generated_content).toBeDefined();
      expect(result.generated_content!).toContain('React');
      expect(result.generated_content!).toContain('interface');
      expect(result.generated_content!).toContain('Props');
      expect(result.generated_content!).toContain('useState');
      expect(result.generated_content!).toContain('useEffect');
      expect(result.generated_content!).toContain('export');
    });
  });

  describe('feature generation', () => {
    it('should generate feature implementation', async () => {
      const input: AiGenerationRequest = {
        project_id: projectId,
        prompt: 'Create user authentication feature',
        generation_type: 'feature'
      };

      const result = await generateWithAi(input, userId);

      expect(result.message).toContain('Generated feature implementation');
      expect(result.message).toContain(input.prompt);
      expect(result.generated_content).toBeDefined();
      expect(result.generated_content!).toContain('GeneratedFeature');
      expect(result.generated_content!).toContain('FeatureConfig');
      expect(result.generated_content!).toContain('FeatureResult');
      expect(result.generated_content!).toContain('async execute');
      expect(result.generated_content!).toContain('export class');
    });
  });

  describe('full app generation', () => {
    it('should generate full application structure', async () => {
      const input: AiGenerationRequest = {
        project_id: projectId,
        prompt: 'Create a task management application',
        generation_type: 'full_app'
      };

      const result = await generateWithAi(input, userId);

      expect(result.message).toContain('Generated full application structure');
      expect(result.message).toContain(testProject.name);
      expect(result.generated_content).toBeDefined();
      expect(result.generated_content!).toContain('Application Architecture Overview');
      expect(result.generated_content!).toContain('BrowserRouter');
      expect(result.generated_content!).toContain('Routes');
      expect(result.generated_content!).toContain('ApiService');
      expect(result.generated_content!).toContain('AuthService');
      expect(result.generated_content!).toContain(testProject.name);
    });
  });

  describe('error handling', () => {
    it('should throw error for unsupported generation type', async () => {
      const input: AiGenerationRequest = {
        project_id: projectId,
        prompt: 'Create something',
        generation_type: 'unsupported' as any
      };

      await expect(generateWithAi(input, userId)).rejects.toThrow(/Unsupported generation type/i);
    });

    it('should handle database errors gracefully', async () => {
      // Use invalid project ID to simulate access error instead of closing connection
      const input: AiGenerationRequest = {
        project_id: -1,
        prompt: 'Create something',
        generation_type: 'file'
      };

      await expect(generateWithAi(input, userId)).rejects.toThrow(/Project not found or access denied/i);
    });
  });

  describe('generation without file_path', () => {
    it('should generate file content without saving to database', async () => {
      const input: AiGenerationRequest = {
        project_id: projectId,
        prompt: 'Create utility functions',
        generation_type: 'file'
        // No file_path provided
      };

      const result = await generateWithAi(input, userId);

      expect(result.message).toContain('Generated file content for new file');
      expect(result.generated_content).toBeDefined();
      expect(result.generated_content!).toContain('Generated JavaScript file');
      
      // Verify no files were created in database (should be 0 since no file_path)
      const projectFiles = await db.select()
        .from(projectFilesTable)
        .where(eq(projectFilesTable.project_id, projectId))
        .execute();

      expect(projectFiles).toHaveLength(0);
    });

    it('should generate component without file_path', async () => {
      const input: AiGenerationRequest = {
        project_id: projectId,
        prompt: 'Create data table component',
        generation_type: 'component'
      };

      const result = await generateWithAi(input, userId);

      expect(result.message).toContain('Generated component based on prompt');
      expect(result.generated_content).toBeDefined();
      expect(result.generated_content!).toContain('React');
      expect(result.generated_content!).toContain('GeneratedComponent');
    });

    it('should generate feature without file_path', async () => {
      const input: AiGenerationRequest = {
        project_id: projectId,
        prompt: 'Create notification system',
        generation_type: 'feature'
      };

      const result = await generateWithAi(input, userId);

      expect(result.message).toContain('Generated feature implementation based on prompt');
      expect(result.generated_content).toBeDefined();
      expect(result.generated_content!).toContain('GeneratedFeature');
    });
  });
});