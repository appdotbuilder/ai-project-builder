import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, projectsTable, projectFilesTable } from '../db/schema';
import { deleteProject } from '../handlers/delete_project';
import { eq } from 'drizzle-orm';

describe('deleteProject', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete a project successfully', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        name: 'Test User'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test project
    const projectResult = await db.insert(projectsTable)
      .values({
        name: 'Test Project',
        description: 'A test project',
        user_id: userId,
        metadata: { test: true }
      })
      .returning()
      .execute();

    const projectId = projectResult[0].id;

    // Delete the project
    const result = await deleteProject(projectId, userId);

    expect(result).toBe(true);

    // Verify project is deleted from database
    const deletedProject = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .execute();

    expect(deletedProject).toHaveLength(0);
  });

  it('should delete project and cascade delete associated files', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        name: 'Test User'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test project
    const projectResult = await db.insert(projectsTable)
      .values({
        name: 'Test Project',
        description: 'A test project',
        user_id: userId
      })
      .returning()
      .execute();

    const projectId = projectResult[0].id;

    // Create test project files
    await db.insert(projectFilesTable)
      .values([
        {
          project_id: projectId,
          path: '/src/index.ts',
          content: 'console.log("Hello World");',
          file_type: 'file',
          parent_id: null
        },
        {
          project_id: projectId,
          path: '/src/utils.ts',
          content: 'export const helper = () => {};',
          file_type: 'file',
          parent_id: null
        }
      ])
      .execute();

    // Verify files exist before deletion
    const filesBefore = await db.select()
      .from(projectFilesTable)
      .where(eq(projectFilesTable.project_id, projectId))
      .execute();

    expect(filesBefore).toHaveLength(2);

    // Delete the project
    const result = await deleteProject(projectId, userId);

    expect(result).toBe(true);

    // Verify project files are cascade deleted
    const filesAfter = await db.select()
      .from(projectFilesTable)
      .where(eq(projectFilesTable.project_id, projectId))
      .execute();

    expect(filesAfter).toHaveLength(0);
  });

  it('should throw error when project does not exist', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        name: 'Test User'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;
    const nonExistentProjectId = 999;

    // Attempt to delete non-existent project
    await expect(deleteProject(nonExistentProjectId, userId)).rejects.toThrow(/project not found or unauthorized/i);
  });

  it('should throw error when user tries to delete another users project', async () => {
    // Create two test users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        password_hash: 'hashed_password',
        name: 'User 1'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        password_hash: 'hashed_password',
        name: 'User 2'
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create project owned by user1
    const projectResult = await db.insert(projectsTable)
      .values({
        name: 'User1 Project',
        description: 'Project owned by user1',
        user_id: user1Id
      })
      .returning()
      .execute();

    const projectId = projectResult[0].id;

    // User2 attempts to delete user1's project
    await expect(deleteProject(projectId, user2Id)).rejects.toThrow(/project not found or unauthorized/i);

    // Verify project still exists
    const existingProject = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .execute();

    expect(existingProject).toHaveLength(1);
    expect(existingProject[0].name).toEqual('User1 Project');
  });

  it('should not affect other users projects when deleting own project', async () => {
    // Create two test users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        password_hash: 'hashed_password',
        name: 'User 1'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        password_hash: 'hashed_password',
        name: 'User 2'
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create projects for both users
    const user1ProjectResult = await db.insert(projectsTable)
      .values({
        name: 'User1 Project',
        description: 'Project owned by user1',
        user_id: user1Id
      })
      .returning()
      .execute();

    const user2ProjectResult = await db.insert(projectsTable)
      .values({
        name: 'User2 Project',
        description: 'Project owned by user2',
        user_id: user2Id
      })
      .returning()
      .execute();

    const user1ProjectId = user1ProjectResult[0].id;
    const user2ProjectId = user2ProjectResult[0].id;

    // User1 deletes their own project
    const result = await deleteProject(user1ProjectId, user1Id);

    expect(result).toBe(true);

    // Verify user1's project is deleted
    const deletedProject = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, user1ProjectId))
      .execute();

    expect(deletedProject).toHaveLength(0);

    // Verify user2's project is still intact
    const remainingProject = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, user2ProjectId))
      .execute();

    expect(remainingProject).toHaveLength(1);
    expect(remainingProject[0].name).toEqual('User2 Project');
  });
});