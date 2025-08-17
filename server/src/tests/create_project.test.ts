import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, projectsTable, projectFilesTable } from '../db/schema';
import { type CreateProjectInput } from '../schema';
import { createProject } from '../handlers/create_project';
import { eq } from 'drizzle-orm';

describe('createProject', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;

  beforeEach(async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        name: 'Test User'
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;
  });

  const testInput: CreateProjectInput = {
    name: 'My Awesome Project',
    description: 'A project for testing',
    user_id: 0, // Will be set to testUserId in tests
    metadata: { framework: 'React', language: 'TypeScript' }
  };

  it('should create a project with all fields', async () => {
    const input = { ...testInput, user_id: testUserId };
    const result = await createProject(input);

    // Basic field validation
    expect(result.name).toEqual('My Awesome Project');
    expect(result.description).toEqual('A project for testing');
    expect(result.user_id).toEqual(testUserId);
    expect(result.metadata).toEqual({ framework: 'React', language: 'TypeScript' });
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a project with null description', async () => {
    const input = { ...testInput, user_id: testUserId, description: null };
    const result = await createProject(input);

    expect(result.name).toEqual('My Awesome Project');
    expect(result.description).toBeNull();
    expect(result.user_id).toEqual(testUserId);
    expect(result.id).toBeDefined();
  });

  it('should create a project without metadata', async () => {
    const input = { 
      name: 'Simple Project',
      description: 'No metadata project',
      user_id: testUserId
    };
    const result = await createProject(input);

    expect(result.name).toEqual('Simple Project');
    expect(result.metadata).toBeNull();
    expect(result.id).toBeDefined();
  });

  it('should save project to database', async () => {
    const input = { ...testInput, user_id: testUserId };
    const result = await createProject(input);

    // Query the database to verify project was saved
    const projects = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, result.id))
      .execute();

    expect(projects).toHaveLength(1);
    expect(projects[0].name).toEqual('My Awesome Project');
    expect(projects[0].description).toEqual('A project for testing');
    expect(projects[0].user_id).toEqual(testUserId);
    expect(projects[0].metadata).toEqual({ framework: 'React', language: 'TypeScript' });
    expect(projects[0].created_at).toBeInstanceOf(Date);
  });

  it('should create initial project directory structure', async () => {
    const input = { ...testInput, user_id: testUserId };
    const result = await createProject(input);

    // Check that initial directories were created
    const files = await db.select()
      .from(projectFilesTable)
      .where(eq(projectFilesTable.project_id, result.id))
      .execute();

    expect(files).toHaveLength(2);
    
    const srcDir = files.find(f => f.path === '/src');
    const publicDir = files.find(f => f.path === '/public');

    expect(srcDir).toBeDefined();
    expect(srcDir?.file_type).toEqual('directory');
    expect(srcDir?.content).toEqual('');
    expect(srcDir?.parent_id).toBeNull();

    expect(publicDir).toBeDefined();
    expect(publicDir?.file_type).toEqual('directory');
    expect(publicDir?.content).toEqual('');
    expect(publicDir?.parent_id).toBeNull();
  });

  it('should throw error for non-existent user', async () => {
    const input = { ...testInput, user_id: 99999 }; // Non-existent user ID
    
    await expect(createProject(input)).rejects.toThrow(/User with id 99999 does not exist/i);
  });

  it('should handle projects with same name for different users', async () => {
    // Create second test user
    const secondUserResult = await db.insert(usersTable)
      .values({
        email: 'test2@example.com',
        password_hash: 'hashedpassword2',
        name: 'Test User 2'
      })
      .returning()
      .execute();
    const secondUserId = secondUserResult[0].id;

    // Create projects with same name for different users
    const input1 = { ...testInput, user_id: testUserId, name: 'Duplicate Name Project' };
    const input2 = { ...testInput, user_id: secondUserId, name: 'Duplicate Name Project' };

    const result1 = await createProject(input1);
    const result2 = await createProject(input2);

    expect(result1.name).toEqual('Duplicate Name Project');
    expect(result2.name).toEqual('Duplicate Name Project');
    expect(result1.user_id).toEqual(testUserId);
    expect(result2.user_id).toEqual(secondUserId);
    expect(result1.id).not.toEqual(result2.id);
  });

  it('should create project with complex metadata structure', async () => {
    const complexMetadata = {
      framework: 'Next.js',
      language: 'TypeScript',
      dependencies: ['react', 'next', 'tailwindcss'],
      config: {
        eslint: true,
        prettier: true,
        typescript: {
          strict: true,
          target: 'ES2022'
        }
      }
    };

    const input = { 
      ...testInput, 
      user_id: testUserId,
      metadata: complexMetadata 
    };
    const result = await createProject(input);

    expect(result.metadata).toEqual(complexMetadata);

    // Verify in database
    const savedProject = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.id, result.id))
      .execute();

    expect(savedProject[0].metadata).toEqual(complexMetadata);
  });
});