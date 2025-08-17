import { db } from '../db';
import { projectsTable } from '../db/schema';
import { type Project } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function getProjects(userId: number): Promise<Project[]> {
  try {
    // Query all projects belonging to the specified user
    const results = await db.select()
      .from(projectsTable)
      .where(eq(projectsTable.user_id, userId))
      .orderBy(desc(projectsTable.updated_at))
      .execute();

    // Convert the results to match the Project schema
    return results.map(project => ({
      ...project,
      // Ensure dates are properly converted
      created_at: project.created_at,
      updated_at: project.updated_at,
      // Cast metadata to the expected type
      metadata: project.metadata as Record<string, any> | null
    }));
  } catch (error) {
    console.error('Failed to get projects:', error);
    throw error;
  }
}