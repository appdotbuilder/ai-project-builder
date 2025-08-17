import { db } from '../db';
import { projectsTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export async function deleteProject(projectId: number, userId: number): Promise<boolean> {
  try {
    // First, verify that the project exists and belongs to the authenticated user
    const project = await db.select()
      .from(projectsTable)
      .where(and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.user_id, userId)
      ))
      .execute();

    if (project.length === 0) {
      throw new Error('Project not found or unauthorized');
    }

    // Delete the project - cascade delete will handle associated files
    const result = await db.delete(projectsTable)
      .where(and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.user_id, userId)
      ))
      .execute();

    return true;
  } catch (error) {
    console.error('Project deletion failed:', error);
    throw error;
  }
}