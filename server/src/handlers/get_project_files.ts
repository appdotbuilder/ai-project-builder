import { db } from '../db';
import { projectsTable, projectFilesTable } from '../db/schema';
import { type ProjectFile } from '../schema';
import { eq, and, desc, asc } from 'drizzle-orm';

export async function getProjectFiles(projectId: number, userId: number): Promise<ProjectFile[]> {
  try {
    // 1. Verify that the project belongs to the authenticated user
    const projectCheck = await db.select()
      .from(projectsTable)
      .where(and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.user_id, userId)
      ))
      .execute();

    if (projectCheck.length === 0) {
      throw new Error('Project not found or access denied');
    }

    // 2. Query all files for the specified project
    // 3. Return files in hierarchical order (directories first, then files)
    const files = await db.select()
      .from(projectFilesTable)
      .where(eq(projectFilesTable.project_id, projectId))
      .orderBy(
        asc(projectFilesTable.file_type), // 'directory' comes before 'file' alphabetically
        asc(projectFilesTable.path)
      )
      .execute();

    // Return files with proper type conversion
    return files;
  } catch (error) {
    console.error('Get project files failed:', error);
    throw error;
  }
}