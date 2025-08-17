import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, projectsTable } from '../db/schema';
import { type UpdateProjectInput } from '../schema';
import { updateProject } from '../handlers/update_project';
import { eq, and } from 'drizzle-orm';

describe('updateProject', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testProjectId: number;
  let otherUserId: number;
  let otherProjectId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        name: 'Test User'
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create another user for access control tests
    const otherUserResult = await db.insert(usersTable)
      .values({
        email: 'other@example.com',
        password_hash: 'hashed_password',
        name: 'Other User'
      })
      .returning()
      .execute();
    otherUserId = otherUserResult[0].id;

    // Create test project
    const projectResult = await db.insert(projectsTable)
      .values({
        name: 'Original Project',
        description: 'Original description',
        user_id: testUserId,
        metadata: { version: '1.0' }
      })
      .returning()
      .execute();
    testProjectId = projectResult[0].id;

    // Create project belonging to other user
    const otherProjectResult = await db.insert(projectsTable)
      .values({
        name: 'Other Project',
        description: 'Other description',
        user_id: otherUserId
      })
      .returning()
      .execute();
    otherProjectId = otherProjectResult[0].id;
  });

  it('should update project name', async () => {
    const input: UpdateProjectInput = {
      id: testProjectId,
      name: 'Updated Project Name'
    };

    const result = await updateProject(input, testUserId);

    expect(result.id).toEqual(testProjectId);
    expect(result.name).toEqual('Updated Project Name');
    expect(result.description).toEqual('Original description');
    expect(result.user_id).toEqual(testUserId);
    expect(result.metadata).toEqual({ version: '1.0' });
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update project description', async () => {
    const input: UpdateProjectInput = {
      id: testProjectId,
      description: 'Updated description'
    };

    const result = await updateProject(input, testUserId);

    expect(result.name).toEqual('Original Project');
    expect(result.description).toEqual('Updated description');
    expect(result.user_id).toEqual(testUserId);
  });

  it('should update project metadata', async () => {
    const newMetadata = { version: '2.0', tags: ['web', 'api'] };
    const input: UpdateProjectInput = {
      id: testProjectId,
      metadata: newMetadata
    };

    const result = await updateProject(input, testUserId);

    expect(result.name).toEqual('Original Project');
    expect(result.metadata).toEqual(newMetadata);
  });

  it('should update multiple fields at once', async () => {
    const input: UpdateProjectInput = {
      id: testProjectId,
      name: 'Fully Updated Project',
      description: 'Fully updated description',
      metadata: { version: '3.0', status: 'active' }
    };

    const result = await updateProject(input, testUserId);

    expect(result.name).toEqual('Fully Updated Project');
    expect(result.description).toEqual('Fully updated description');
    expect(result.metadata).toEqual({ version: '3.0', status: 'active' });
    expect(result.user_id).toEqual(testUserId);
  });

  it('should set description to null', async () => {
    const input: UpdateProjectInput = {
      id: testProjectId,
      description: null
    };

    const result = await updateProject(input, testUserId);

    expect(result.description).toBeNull();
    expect(result.name).toEqual('Original Project'); // Other fields unchanged
  });

  it('should set metadata to null', async () => {
    const input: UpdateProjectInput = {
      id: testProjectId,
      metadata: null
    };

    const result = await updateProject(input, testUserId);

    expect(result.metadata).toBeNull();
    expect(result.name).toEqual('Original Project'); // Other fields unchanged
  });

  it('should save updates to database', async () => {
    const input: UpdateProjectInput = {
      id: testProjectId,
      name: 'Database Test Project'
    };

    await updateProject(input, testUserId);

    // Verify the changes were persisted
    const projects = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, testProjectId))
      .execute();

    expect(projects).toHaveLength(1);
    expect(projects[0].name).toEqual('Database Test Project');
    expect(projects[0].updated_at).toBeInstanceOf(Date);
  });

  it('should update the updated_at timestamp', async () => {
    // Get original timestamp
    const originalProject = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, testProjectId))
      .execute();
    
    const originalTimestamp = originalProject[0].updated_at;

    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const input: UpdateProjectInput = {
      id: testProjectId,
      name: 'Timestamp Test Project'
    };

    const result = await updateProject(input, testUserId);

    expect(result.updated_at.getTime()).toBeGreaterThan(originalTimestamp.getTime());
  });

  it('should throw error for non-existent project', async () => {
    const input: UpdateProjectInput = {
      id: 99999,
      name: 'Non-existent Project'
    };

    expect(updateProject(input, testUserId)).rejects.toThrow(/project not found/i);
  });

  it('should throw error when user tries to update another user\'s project', async () => {
    const input: UpdateProjectInput = {
      id: otherProjectId,
      name: 'Unauthorized Update'
    };

    expect(updateProject(input, testUserId)).rejects.toThrow(/project not found|access denied/i);
  });

  it('should not update fields when they are undefined', async () => {
    const input: UpdateProjectInput = {
      id: testProjectId
      // No fields provided for update
    };

    const result = await updateProject(input, testUserId);

    // All original values should remain unchanged
    expect(result.name).toEqual('Original Project');
    expect(result.description).toEqual('Original description');
    expect(result.metadata).toEqual({ version: '1.0' });
    expect(result.user_id).toEqual(testUserId);
    
    // Only updated_at should change
    expect(result.updated_at).toBeInstanceOf(Date);
  });
})