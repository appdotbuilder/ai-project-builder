import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, projectsTable } from '../db/schema';
import { type CreateProjectInput } from '../schema';
import { getProjects } from '../handlers/get_projects';
import { eq } from 'drizzle-orm';

// Helper to create a test user
const createTestUser = async () => {
  const result = await db.insert(usersTable)
    .values({
      email: 'test@example.com',
      password_hash: 'hashed_password',
      name: 'Test User'
    })
    .returning()
    .execute();
  return result[0];
};

// Helper to create a test project
const createTestProject = async (userId: number, name: string, description?: string) => {
  const result = await db.insert(projectsTable)
    .values({
      name,
      description: description || null,
      user_id: userId,
      metadata: null
    })
    .returning()
    .execute();
  return result[0];
};

describe('getProjects', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array for user with no projects', async () => {
    const user = await createTestUser();
    
    const result = await getProjects(user.id);

    expect(result).toEqual([]);
  });

  it('should return projects for a specific user', async () => {
    const user = await createTestUser();
    
    // Create projects for this user
    await createTestProject(user.id, 'Project 1', 'First project');
    await createTestProject(user.id, 'Project 2', 'Second project');

    const result = await getProjects(user.id);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBeDefined();
    expect(result[0].user_id).toEqual(user.id);
    expect(result[1].name).toBeDefined();
    expect(result[1].user_id).toEqual(user.id);
  });

  it('should return projects ordered by updated_at desc', async () => {
    const user = await createTestUser();
    
    // Create first project
    const project1 = await createTestProject(user.id, 'Project 1');
    
    // Wait a moment to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Create second project (should be more recent)
    const project2 = await createTestProject(user.id, 'Project 2');

    const result = await getProjects(user.id);

    expect(result).toHaveLength(2);
    // Most recent project should be first
    expect(result[0].id).toEqual(project2.id);
    expect(result[0].name).toEqual('Project 2');
    expect(result[1].id).toEqual(project1.id);
    expect(result[1].name).toEqual('Project 1');
    
    // Verify timestamps are in correct order
    expect(result[0].updated_at >= result[1].updated_at).toBe(true);
  });

  it('should only return projects for the specified user', async () => {
    // Create two different users
    const user1 = await createTestUser();
    
    const user2 = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        password_hash: 'hashed_password_2',
        name: 'User 2'
      })
      .returning()
      .execute();

    // Create projects for both users
    await createTestProject(user1.id, 'User 1 Project 1');
    await createTestProject(user1.id, 'User 1 Project 2');
    await createTestProject(user2[0].id, 'User 2 Project 1');

    // Get projects for user1
    const user1Projects = await getProjects(user1.id);
    
    // Get projects for user2
    const user2Projects = await getProjects(user2[0].id);

    // Verify each user only sees their own projects
    expect(user1Projects).toHaveLength(2);
    expect(user2Projects).toHaveLength(1);
    
    user1Projects.forEach(project => {
      expect(project.user_id).toEqual(user1.id);
    });
    
    user2Projects.forEach(project => {
      expect(project.user_id).toEqual(user2[0].id);
    });
    
    expect(user2Projects[0].name).toEqual('User 2 Project 1');
  });

  it('should include all project fields correctly', async () => {
    const user = await createTestUser();
    
    // Create project with metadata
    const projectData = {
      name: 'Test Project',
      description: 'A test project with metadata',
      user_id: user.id,
      metadata: { key: 'value', number: 42 }
    };
    
    await db.insert(projectsTable)
      .values(projectData)
      .execute();

    const result = await getProjects(user.id);

    expect(result).toHaveLength(1);
    const project = result[0];
    
    expect(project.id).toBeDefined();
    expect(project.name).toEqual('Test Project');
    expect(project.description).toEqual('A test project with metadata');
    expect(project.user_id).toEqual(user.id);
    expect(project.metadata).toEqual({ key: 'value', number: 42 });
    expect(project.created_at).toBeInstanceOf(Date);
    expect(project.updated_at).toBeInstanceOf(Date);
  });

  it('should handle projects with null description and metadata', async () => {
    const user = await createTestUser();
    
    await createTestProject(user.id, 'Minimal Project');

    const result = await getProjects(user.id);

    expect(result).toHaveLength(1);
    const project = result[0];
    
    expect(project.name).toEqual('Minimal Project');
    expect(project.description).toBeNull();
    expect(project.metadata).toBeNull();
  });

  it('should save projects to database correctly', async () => {
    const user = await createTestUser();
    
    // Create a project through the handler's data flow
    await createTestProject(user.id, 'Database Test Project', 'Testing database consistency');

    const result = await getProjects(user.id);
    
    // Verify the data exists in the database by querying directly
    const dbProjects = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.user_id, user.id))
      .execute();

    expect(result).toHaveLength(1);
    expect(dbProjects).toHaveLength(1);
    
    // Verify handler result matches database data
    expect(result[0].id).toEqual(dbProjects[0].id);
    expect(result[0].name).toEqual(dbProjects[0].name);
    expect(result[0].description).toEqual(dbProjects[0].description);
    expect(result[0].user_id).toEqual(dbProjects[0].user_id);
  });
});