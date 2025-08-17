import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, projectsTable, projectFilesTable } from '../db/schema';
import { deleteProjectFile } from '../handlers/delete_project_file';
import { eq } from 'drizzle-orm';

describe('deleteProjectFile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let otherUserId: number;
  let testProjectId: number;
  let otherProjectId: number;

  beforeEach(async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'test@example.com',
          password_hash: 'hashed_password',
          name: 'Test User'
        },
        {
          email: 'other@example.com',
          password_hash: 'hashed_password',
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
          description: 'A test project',
          user_id: testUserId
        },
        {
          name: 'Other Project',
          description: 'Another user\'s project',
          user_id: otherUserId
        }
      ])
      .returning()
      .execute();

    testProjectId = projects[0].id;
    otherProjectId = projects[1].id;
  });

  it('should delete a file successfully', async () => {
    // Create a test file
    const files = await db.insert(projectFilesTable)
      .values({
        project_id: testProjectId,
        path: '/src/test.ts',
        content: 'console.log("test");',
        file_type: 'file',
        parent_id: null
      })
      .returning()
      .execute();

    const fileId = files[0].id;

    // Delete the file
    const result = await deleteProjectFile(fileId, testUserId);

    expect(result).toBe(true);

    // Verify file is deleted from database
    const deletedFiles = await db.select()
      .from(projectFilesTable)
      .where(eq(projectFilesTable.id, fileId))
      .execute();

    expect(deletedFiles).toHaveLength(0);
  });

  it('should delete an empty directory successfully', async () => {
    // Create a test directory
    const directories = await db.insert(projectFilesTable)
      .values({
        project_id: testProjectId,
        path: '/src',
        content: '',
        file_type: 'directory',
        parent_id: null
      })
      .returning()
      .execute();

    const dirId = directories[0].id;

    // Delete the directory
    const result = await deleteProjectFile(dirId, testUserId);

    expect(result).toBe(true);

    // Verify directory is deleted from database
    const deletedDirectories = await db.select()
      .from(projectFilesTable)
      .where(eq(projectFilesTable.id, dirId))
      .execute();

    expect(deletedDirectories).toHaveLength(0);
  });

  it('should throw error when trying to delete non-existent file', async () => {
    const nonExistentFileId = 99999;

    await expect(deleteProjectFile(nonExistentFileId, testUserId))
      .rejects.toThrow(/file not found or access denied/i);
  });

  it('should throw error when user does not own the project', async () => {
    // Create a file in other user's project
    const files = await db.insert(projectFilesTable)
      .values({
        project_id: otherProjectId,
        path: '/src/test.ts',
        content: 'console.log("test");',
        file_type: 'file',
        parent_id: null
      })
      .returning()
      .execute();

    const fileId = files[0].id;

    // Try to delete file with wrong user
    await expect(deleteProjectFile(fileId, testUserId))
      .rejects.toThrow(/file not found or access denied/i);

    // Verify file still exists
    const existingFiles = await db.select()
      .from(projectFilesTable)
      .where(eq(projectFilesTable.id, fileId))
      .execute();

    expect(existingFiles).toHaveLength(1);
  });

  it('should throw error when trying to delete directory with children', async () => {
    // Create a parent directory
    const directories = await db.insert(projectFilesTable)
      .values({
        project_id: testProjectId,
        path: '/src',
        content: '',
        file_type: 'directory',
        parent_id: null
      })
      .returning()
      .execute();

    const parentDirId = directories[0].id;

    // Create a child file in the directory
    await db.insert(projectFilesTable)
      .values({
        project_id: testProjectId,
        path: '/src/index.ts',
        content: 'export const app = "Hello World";',
        file_type: 'file',
        parent_id: parentDirId
      })
      .execute();

    // Try to delete the parent directory
    await expect(deleteProjectFile(parentDirId, testUserId))
      .rejects.toThrow(/cannot delete directory that contains files or subdirectories/i);

    // Verify directory still exists
    const existingDirectories = await db.select()
      .from(projectFilesTable)
      .where(eq(projectFilesTable.id, parentDirId))
      .execute();

    expect(existingDirectories).toHaveLength(1);
  });

  it('should handle deletion of file with valid parent_id', async () => {
    // Create a parent directory
    const directories = await db.insert(projectFilesTable)
      .values({
        project_id: testProjectId,
        path: '/src',
        content: '',
        file_type: 'directory',
        parent_id: null
      })
      .returning()
      .execute();

    const parentDirId = directories[0].id;

    // Create a child file
    const files = await db.insert(projectFilesTable)
      .values({
        project_id: testProjectId,
        path: '/src/utils.ts',
        content: 'export const helper = () => {};',
        file_type: 'file',
        parent_id: parentDirId
      })
      .returning()
      .execute();

    const childFileId = files[0].id;

    // Delete the child file
    const result = await deleteProjectFile(childFileId, testUserId);

    expect(result).toBe(true);

    // Verify child file is deleted
    const deletedFiles = await db.select()
      .from(projectFilesTable)
      .where(eq(projectFilesTable.id, childFileId))
      .execute();

    expect(deletedFiles).toHaveLength(0);

    // Verify parent directory still exists
    const existingDirectories = await db.select()
      .from(projectFilesTable)
      .where(eq(projectFilesTable.id, parentDirId))
      .execute();

    expect(existingDirectories).toHaveLength(1);
  });

  it('should verify proper authorization check with valid user', async () => {
    // Create a file in the correct user's project
    const files = await db.insert(projectFilesTable)
      .values({
        project_id: testProjectId,
        path: '/config.json',
        content: '{"name": "test"}',
        file_type: 'file',
        parent_id: null
      })
      .returning()
      .execute();

    const fileId = files[0].id;

    // Verify correct user can delete
    const result = await deleteProjectFile(fileId, testUserId);
    expect(result).toBe(true);
  });
});