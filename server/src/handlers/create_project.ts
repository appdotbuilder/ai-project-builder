import { db } from '../db';
import { projectsTable, usersTable, projectFilesTable } from '../db/schema';
import { type CreateProjectInput, type Project } from '../schema';
import { eq } from 'drizzle-orm';

export async function createProject(input: CreateProjectInput): Promise<Project> {
  try {
    // 1. Validate that the user_id exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error(`User with id ${input.user_id} does not exist`);
    }

    // 2. Create new project record in the database
    const result = await db.insert(projectsTable)
      .values({
        name: input.name,
        description: input.description || null,
        user_id: input.user_id,
        metadata: input.metadata || null
      })
      .returning()
      .execute();

    const project = result[0];

    // 3. Create initial project structure (src/ and public/ directories)
    await db.insert(projectFilesTable)
      .values([
        {
          project_id: project.id,
          path: '/src',
          content: '',
          file_type: 'directory',
          parent_id: null
        },
        {
          project_id: project.id,
          path: '/public',
          content: '',
          file_type: 'directory',
          parent_id: null
        }
      ])
      .execute();

    // 4. Return the created project data
    return {
      ...project,
      metadata: project.metadata as Record<string, any> | null
    };
  } catch (error) {
    console.error('Project creation failed:', error);
    throw error;
  }
}