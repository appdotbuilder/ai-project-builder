import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, projectsTable, projectFilesTable } from '../db/schema';
import { getProjectFiles } from '../handlers/get_project_files';

describe('getProjectFiles', () => {
  let testUserId: number;
  let otherUserId: number;
  let testProjectId: number;
  let otherProjectId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'test@example.com',
          password_hash: 'hashedpassword123',
          name: 'Test User'
        },
        {
          email: 'other@example.com',
          password_hash: 'hashedpassword456',
          name: 'Other User'
        }
      ])
      .returning()
      .execute();

    testUserId = users[0].id;
    otherUserId = users[1].id;

    // Create test projects
    const projects = await db.insert(projectsTable)
      .values([
        {
          name: 'Test Project',
          description: 'A project for testing',
          user_id: testUserId,
          metadata: { type: 'web' }
        },
        {
          name: 'Other Project',
          description: 'Another user\'s project',
          user_id: otherUserId,
          metadata: { type: 'mobile' }
        }
      ])
      .returning()
      .execute();

    testProjectId = projects[0].id;
    otherProjectId = projects[1].id;
  });

  afterEach(resetDB);

  it('should get project files for authenticated user', async () => {
    // Create test files with hierarchical structure
    const insertedFiles = await db.insert(projectFilesTable)
      .values([
        {
          project_id: testProjectId,
          path: '/src',
          content: '',
          file_type: 'directory',
          parent_id: null
        },
        {
          project_id: testProjectId,
          path: '/src/index.ts',
          content: 'console.log("Hello World");',
          file_type: 'file',
          parent_id: null
        },
        {
          project_id: testProjectId,
          path: '/README.md',
          content: '# Test Project\n\nThis is a test project.',
          file_type: 'file',
          parent_id: null
        }
      ])
      .returning()
      .execute();

    const result = await getProjectFiles(testProjectId, testUserId);

    // Should return all files for the project
    expect(result).toHaveLength(3);

    // Directories should come first in alphabetical order, then files
    // Since 'directory' < 'file' alphabetically, directories come first
    const directories = result.filter(f => f.file_type === 'directory');
    const files = result.filter(f => f.file_type === 'file');

    expect(directories).toHaveLength(1);
    expect(directories[0].path).toEqual('/src');
    expect(directories[0].content).toEqual('');

    expect(files).toHaveLength(2);
    // Files ordered alphabetically by path
    expect(files[0].path).toEqual('/README.md');
    expect(files[1].path).toEqual('/src/index.ts');

    // Verify all fields are present
    result.forEach(file => {
      expect(file.id).toBeDefined();
      expect(file.project_id).toEqual(testProjectId);
      expect(file.path).toBeDefined();
      expect(file.content).toBeDefined();
      expect(file.file_type).toMatch(/^(file|directory)$/);
      expect(file.created_at).toBeInstanceOf(Date);
      expect(file.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should return empty array for project with no files', async () => {
    const result = await getProjectFiles(testProjectId, testUserId);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should throw error when project does not belong to user', async () => {
    // Try to access other user's project
    await expect(getProjectFiles(otherProjectId, testUserId))
      .rejects.toThrow(/Project not found or access denied/i);
  });

  it('should throw error when project does not exist', async () => {
    const nonExistentProjectId = 99999;

    await expect(getProjectFiles(nonExistentProjectId, testUserId))
      .rejects.toThrow(/Project not found or access denied/i);
  });

  it('should handle complex file hierarchies correctly', async () => {
    // Create a more complex file structure
    const createdFiles = await db.insert(projectFilesTable)
      .values([
        // Root level directories
        {
          project_id: testProjectId,
          path: '/public',
          content: '',
          file_type: 'directory',
          parent_id: null
        },
        {
          project_id: testProjectId,
          path: '/src',
          content: '',
          file_type: 'directory',
          parent_id: null
        },
        // Files in directories
        {
          project_id: testProjectId,
          path: '/src/components',
          content: '',
          file_type: 'directory',
          parent_id: null
        },
        {
          project_id: testProjectId,
          path: '/src/index.ts',
          content: 'import "./components/App";',
          file_type: 'file',
          parent_id: null
        },
        {
          project_id: testProjectId,
          path: '/public/index.html',
          content: '<!DOCTYPE html>',
          file_type: 'file',
          parent_id: null
        },
        // Root level files
        {
          project_id: testProjectId,
          path: '/package.json',
          content: '{"name": "test-project"}',
          file_type: 'file',
          parent_id: null
        }
      ])
      .returning()
      .execute();

    const result = await getProjectFiles(testProjectId, testUserId);

    expect(result).toHaveLength(6);

    // Verify ordering: directories first (alphabetically), then files (alphabetically)
    const directories = result.filter(f => f.file_type === 'directory');
    const resultFiles = result.filter(f => f.file_type === 'file');

    expect(directories).toHaveLength(3);
    expect(directories[0].path).toEqual('/public');
    expect(directories[1].path).toEqual('/src');
    expect(directories[2].path).toEqual('/src/components');

    expect(resultFiles).toHaveLength(3);
    expect(resultFiles[0].path).toEqual('/package.json');
    expect(resultFiles[1].path).toEqual('/public/index.html');
    expect(resultFiles[2].path).toEqual('/src/index.ts');
  });

  it('should verify project ownership correctly', async () => {
    // Create files for both projects
    await db.insert(projectFilesTable)
      .values([
        {
          project_id: testProjectId,
          path: '/test-file.txt',
          content: 'test content',
          file_type: 'file',
          parent_id: null
        },
        {
          project_id: otherProjectId,
          path: '/other-file.txt',
          content: 'other content',
          file_type: 'file',
          parent_id: null
        }
      ])
      .execute();

    // User should only see their own project's files
    const userFiles = await getProjectFiles(testProjectId, testUserId);
    expect(userFiles).toHaveLength(1);
    expect(userFiles[0].path).toEqual('/test-file.txt');
    expect(userFiles[0].content).toEqual('test content');

    // Other user should only see their own project's files
    const otherFiles = await getProjectFiles(otherProjectId, otherUserId);
    expect(otherFiles).toHaveLength(1);
    expect(otherFiles[0].path).toEqual('/other-file.txt');
    expect(otherFiles[0].content).toEqual('other content');
  });
});