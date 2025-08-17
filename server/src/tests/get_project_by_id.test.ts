import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, projectsTable } from '../db/schema';
import { getProjectById } from '../handlers/get_project_by_id';

describe('getProjectById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return project when user owns the project', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
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
        metadata: { version: '1.0.0' }
      })
      .returning()
      .execute();

    const projectId = projectResult[0].id;

    // Get project by ID
    const result = await getProjectById(projectId, userId);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(projectId);
    expect(result!.name).toBe('Test Project');
    expect(result!.description).toBe('A test project');
    expect(result!.user_id).toBe(userId);
    expect(result!.metadata).toEqual({ version: '1.0.0' });
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when project does not exist', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        name: 'Test User'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;
    const nonExistentProjectId = 99999;

    const result = await getProjectById(nonExistentProjectId, userId);

    expect(result).toBeNull();
  });

  it('should return null when project exists but belongs to different user', async () => {
    // Create first user and their project
    const owner = await db.insert(usersTable)
      .values({
        email: 'owner@example.com',
        password_hash: 'hashedpassword',
        name: 'Project Owner'
      })
      .returning()
      .execute();

    const ownerId = owner[0].id;

    const projectResult = await db.insert(projectsTable)
      .values({
        name: 'Owners Project',
        description: 'A project owned by someone else',
        user_id: ownerId
      })
      .returning()
      .execute();

    const projectId = projectResult[0].id;

    // Create different user who should not have access
    const otherUser = await db.insert(usersTable)
      .values({
        email: 'other@example.com',
        password_hash: 'hashedpassword',
        name: 'Other User'
      })
      .returning()
      .execute();

    const otherUserId = otherUser[0].id;

    // Try to get project with wrong user ID
    const result = await getProjectById(projectId, otherUserId);

    expect(result).toBeNull();
  });

  it('should handle project with null description and metadata', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        name: 'Test User'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create project with minimal data (null description and metadata)
    const projectResult = await db.insert(projectsTable)
      .values({
        name: 'Minimal Project',
        user_id: userId
      })
      .returning()
      .execute();

    const projectId = projectResult[0].id;

    // Get project by ID
    const result = await getProjectById(projectId, userId);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(projectId);
    expect(result!.name).toBe('Minimal Project');
    expect(result!.description).toBeNull();
    expect(result!.user_id).toBe(userId);
    expect(result!.metadata).toBeNull();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should handle complex metadata structure', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        name: 'Test User'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    const complexMetadata = {
      version: '2.1.0',
      dependencies: ['react', 'typescript'],
      config: {
        build: 'webpack',
        test: 'jest'
      },
      tags: ['web', 'frontend']
    };

    // Create project with complex metadata
    const projectResult = await db.insert(projectsTable)
      .values({
        name: 'Complex Project',
        description: 'Project with complex metadata',
        user_id: userId,
        metadata: complexMetadata
      })
      .returning()
      .execute();

    const projectId = projectResult[0].id;

    // Get project by ID
    const result = await getProjectById(projectId, userId);

    expect(result).not.toBeNull();
    expect(result!.metadata).toEqual(complexMetadata);
    expect(result!.metadata!['version']).toBe('2.1.0');
    expect(result!.metadata!['dependencies']).toEqual(['react', 'typescript']);
    expect(result!.metadata!['config']['build']).toBe('webpack');
  });
});