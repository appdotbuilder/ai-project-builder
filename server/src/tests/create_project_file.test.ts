import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, projectsTable, projectFilesTable } from '../db/schema';
import { type CreateProjectFileInput } from '../schema';
import { createProjectFile } from '../handlers/create_project_file';
import { eq, and } from 'drizzle-orm';

// Test user data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password',
  name: 'Test User'
};

const anotherUser = {
  email: 'another@example.com',
  password_hash: 'hashed_password',
  name: 'Another User'
};

// Test project data
const testProject = {
  name: 'Test Project',
  description: 'A project for testing',
  metadata: { framework: 'react' }
};

describe('createProjectFile', () => {
  let userId: number;
  let anotherUserId: number;
  let projectId: number;
  let parentDirId: number;

  beforeEach(async () => {
    await createDB();

    // Create test users
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    const anotherUserResult = await db.insert(usersTable)
      .values(anotherUser)
      .returning()
      .execute();
    anotherUserId = anotherUserResult[0].id;

    // Create test project
    const projectResult = await db.insert(projectsTable)
      .values({
        ...testProject,
        user_id: userId
      })
      .returning()
      .execute();
    projectId = projectResult[0].id;

    // Create parent directory for hierarchy tests
    const parentDirResult = await db.insert(projectFilesTable)
      .values({
        project_id: projectId,
        path: '/src',
        content: '',
        file_type: 'directory',
        parent_id: null
      })
      .returning()
      .execute();
    parentDirId = parentDirResult[0].id;
  });

  afterEach(resetDB);

  it('should create a project file', async () => {
    const input: CreateProjectFileInput = {
      project_id: projectId,
      path: '/src/index.ts',
      content: 'console.log("Hello World");',
      file_type: 'file',
      parent_id: null
    };

    const result = await createProjectFile(input, userId);

    // Verify returned data
    expect(result.project_id).toEqual(projectId);
    expect(result.path).toEqual('/src/index.ts');
    expect(result.content).toEqual('console.log("Hello World");');
    expect(result.file_type).toEqual('file');
    expect(result.parent_id).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save project file to database', async () => {
    const input: CreateProjectFileInput = {
      project_id: projectId,
      path: '/README.md',
      content: '# Test Project\n\nThis is a test.',
      file_type: 'file',
      parent_id: null
    };

    const result = await createProjectFile(input, userId);

    // Verify database record
    const files = await db.select()
      .from(projectFilesTable)
      .where(eq(projectFilesTable.id, result.id))
      .execute();

    expect(files).toHaveLength(1);
    expect(files[0].project_id).toEqual(projectId);
    expect(files[0].path).toEqual('/README.md');
    expect(files[0].content).toEqual('# Test Project\n\nThis is a test.');
    expect(files[0].file_type).toEqual('file');
    expect(files[0].parent_id).toBeNull();
    expect(files[0].created_at).toBeInstanceOf(Date);
    expect(files[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create a directory', async () => {
    const input: CreateProjectFileInput = {
      project_id: projectId,
      path: '/components',
      content: '',
      file_type: 'directory',
      parent_id: null
    };

    const result = await createProjectFile(input, userId);

    expect(result.file_type).toEqual('directory');
    expect(result.content).toEqual('');
    expect(result.path).toEqual('/components');
  });

  it('should create a file with a parent directory', async () => {
    const input: CreateProjectFileInput = {
      project_id: projectId,
      path: '/src/utils.ts',
      content: 'export const helper = () => {};',
      file_type: 'file',
      parent_id: parentDirId
    };

    const result = await createProjectFile(input, userId);

    expect(result.parent_id).toEqual(parentDirId);
    expect(result.path).toEqual('/src/utils.ts');
    expect(result.content).toEqual('export const helper = () => {};');
  });

  it('should throw error if project not found', async () => {
    const input: CreateProjectFileInput = {
      project_id: 99999, // Non-existent project
      path: '/test.ts',
      content: 'test',
      file_type: 'file',
      parent_id: null
    };

    await expect(createProjectFile(input, userId)).rejects.toThrow(/project not found or access denied/i);
  });

  it('should throw error if user does not own project', async () => {
    const input: CreateProjectFileInput = {
      project_id: projectId,
      path: '/unauthorized.ts',
      content: 'test',
      file_type: 'file',
      parent_id: null
    };

    await expect(createProjectFile(input, anotherUserId)).rejects.toThrow(/project not found or access denied/i);
  });

  it('should throw error if file path already exists', async () => {
    const input: CreateProjectFileInput = {
      project_id: projectId,
      path: '/duplicate.ts',
      content: 'first file',
      file_type: 'file',
      parent_id: null
    };

    // Create first file
    await createProjectFile(input, userId);

    // Try to create duplicate
    const duplicateInput: CreateProjectFileInput = {
      project_id: projectId,
      path: '/duplicate.ts',
      content: 'second file',
      file_type: 'file',
      parent_id: null
    };

    await expect(createProjectFile(duplicateInput, userId)).rejects.toThrow(/file path already exists/i);
  });

  it('should throw error if parent_id does not exist', async () => {
    const input: CreateProjectFileInput = {
      project_id: projectId,
      path: '/src/component.ts',
      content: 'export const Component = () => {};',
      file_type: 'file',
      parent_id: 99999 // Non-existent parent
    };

    await expect(createProjectFile(input, userId)).rejects.toThrow(/parent directory not found/i);
  });

  it('should throw error if parent_id is not a directory', async () => {
    // Create a file to use as invalid parent
    const fileResult = await db.insert(projectFilesTable)
      .values({
        project_id: projectId,
        path: '/config.json',
        content: '{}',
        file_type: 'file',
        parent_id: null
      })
      .returning()
      .execute();

    const input: CreateProjectFileInput = {
      project_id: projectId,
      path: '/config/settings.json',
      content: '{"key": "value"}',
      file_type: 'file',
      parent_id: fileResult[0].id // File, not directory
    };

    await expect(createProjectFile(input, userId)).rejects.toThrow(/parent must be a directory/i);
  });

  it('should throw error if parent belongs to different project', async () => {
    // Create another project
    const anotherProjectResult = await db.insert(projectsTable)
      .values({
        name: 'Another Project',
        description: 'Different project',
        user_id: userId
      })
      .returning()
      .execute();

    const anotherProjectId = anotherProjectResult[0].id;

    const input: CreateProjectFileInput = {
      project_id: anotherProjectId,
      path: '/src/test.ts',
      content: 'test',
      file_type: 'file',
      parent_id: parentDirId // Parent from different project
    };

    await expect(createProjectFile(input, userId)).rejects.toThrow(/parent directory not found/i);
  });

  it('should handle null parent_id correctly', async () => {
    const input: CreateProjectFileInput = {
      project_id: projectId,
      path: '/root-file.ts',
      content: 'root level file',
      file_type: 'file',
      parent_id: null
    };

    const result = await createProjectFile(input, userId);

    expect(result.parent_id).toBeNull();
  });

  it('should create multiple files with different paths', async () => {
    const inputs: CreateProjectFileInput[] = [
      {
        project_id: projectId,
        path: '/package.json',
        content: '{"name": "test"}',
        file_type: 'file',
        parent_id: null
      },
      {
        project_id: projectId,
        path: '/src/main.ts',
        content: 'import "./app";',
        file_type: 'file',
        parent_id: parentDirId
      }
    ];

    const results = await Promise.all(
      inputs.map(input => createProjectFile(input, userId))
    );

    expect(results).toHaveLength(2);
    expect(results[0].path).toEqual('/package.json');
    expect(results[1].path).toEqual('/src/main.ts');
    expect(results[1].parent_id).toEqual(parentDirId);
  });
});