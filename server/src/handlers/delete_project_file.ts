import { db } from '../db';
import { projectFilesTable, projectsTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export async function deleteProjectFile(fileId: number, userId: number): Promise<boolean> {
  try {
    // First, verify that the file exists and belongs to a project owned by the user
    const fileWithProject = await db.select({
      file: projectFilesTable,
      project: projectsTable
    })
      .from(projectFilesTable)
      .innerJoin(projectsTable, eq(projectFilesTable.project_id, projectsTable.id))
      .where(and(
        eq(projectFilesTable.id, fileId),
        eq(projectsTable.user_id, userId)
      ))
      .execute();

    if (fileWithProject.length === 0) {
      throw new Error('File not found or access denied');
    }

    const fileData = fileWithProject[0].file;

    // If deleting a directory, check if it has children
    if (fileData.file_type === 'directory') {
      const children = await db.select()
        .from(projectFilesTable)
        .where(eq(projectFilesTable.parent_id, fileId))
        .execute();

      if (children.length > 0) {
        throw new Error('Cannot delete directory that contains files or subdirectories');
      }
    }

    // Delete the file/directory record
    const result = await db.delete(projectFilesTable)
      .where(eq(projectFilesTable.id, fileId))
      .execute();

    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error('Delete project file failed:', error);
    throw error;
  }
}