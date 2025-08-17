import { db } from '../db';
import { projectsTable, projectFilesTable } from '../db/schema';
import { type ProjectWithFiles } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function getProjectWithFiles(projectId: number, userId: number): Promise<ProjectWithFiles | null> {
  try {
    // First verify that the project exists and belongs to the user
    const project = await db.select()
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.id, projectId),
          eq(projectsTable.user_id, userId)
        )
      )
      .execute();

    if (project.length === 0) {
      return null;
    }

    // Get all files for this project
    const files = await db.select()
      .from(projectFilesTable)
      .where(eq(projectFilesTable.project_id, projectId))
      .execute();

    // Convert the database result to match the expected schema types
    const projectData = project[0];
    return {
      project: {
        ...projectData,
        metadata: projectData.metadata as Record<string, any> | null
      },
      files: files
    };
  } catch (error) {
    console.error('Failed to get project with files:', error);
    throw error;
  }
}