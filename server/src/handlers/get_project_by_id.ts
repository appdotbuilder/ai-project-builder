import { db } from '../db';
import { projectsTable } from '../db/schema';
import { type Project } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function getProjectById(projectId: number, userId: number): Promise<Project | null> {
  try {
    // Query project by ID and ensure it belongs to the authenticated user
    const results = await db.select()
      .from(projectsTable)
      .where(and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.user_id, userId)
      ))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const project = results[0];
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      user_id: project.user_id,
      metadata: project.metadata as Record<string, any> | null,
      created_at: project.created_at,
      updated_at: project.updated_at
    };
  } catch (error) {
    console.error('Failed to get project by ID:', error);
    throw error;
  }
}