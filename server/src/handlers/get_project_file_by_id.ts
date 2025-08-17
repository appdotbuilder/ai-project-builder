import { db } from '../db';
import { projectFilesTable, projectsTable } from '../db/schema';
import { type ProjectFile } from '../schema';
import { eq } from 'drizzle-orm';

export async function getProjectFileById(fileId: number, userId: number): Promise<ProjectFile | null> {
  try {
    // Query file with join to project to verify user ownership in a single query
    const results = await db.select({
      id: projectFilesTable.id,
      project_id: projectFilesTable.project_id,
      path: projectFilesTable.path,
      content: projectFilesTable.content,
      file_type: projectFilesTable.file_type,
      parent_id: projectFilesTable.parent_id,
      created_at: projectFilesTable.created_at,
      updated_at: projectFilesTable.updated_at,
    })
    .from(projectFilesTable)
    .innerJoin(projectsTable, eq(projectFilesTable.project_id, projectsTable.id))
    .where(eq(projectFilesTable.id, fileId))
    .execute();

    if (results.length === 0) {
      return null; // File not found
    }

    const fileData = results[0];

    // Verify that the project belongs to the authenticated user
    const projectOwner = await db.select({ user_id: projectsTable.user_id })
      .from(projectsTable)
      .where(eq(projectsTable.id, fileData.project_id))
      .execute();

    if (projectOwner.length === 0 || projectOwner[0].user_id !== userId) {
      return null; // Unauthorized - project doesn't belong to user
    }

    return fileData;
  } catch (error) {
    console.error('Failed to get project file by ID:', error);
    throw error;
  }
}