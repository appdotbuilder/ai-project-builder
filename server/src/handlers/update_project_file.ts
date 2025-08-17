import { db } from '../db';
import { projectFilesTable, projectsTable } from '../db/schema';
import { type UpdateProjectFileInput, type ProjectFile } from '../schema';
import { eq, and } from 'drizzle-orm';

export const updateProjectFile = async (input: UpdateProjectFileInput, userId: number): Promise<ProjectFile> => {
  try {
    // First, verify that the file exists and belongs to a project owned by the user
    const existingFileQuery = await db.select({
      file: projectFilesTable,
      project: projectsTable
    })
    .from(projectFilesTable)
    .innerJoin(projectsTable, eq(projectFilesTable.project_id, projectsTable.id))
    .where(
      and(
        eq(projectFilesTable.id, input.id),
        eq(projectsTable.user_id, userId)
      )
    )
    .execute();

    if (existingFileQuery.length === 0) {
      throw new Error('File not found or access denied');
    }

    const existingFile = existingFileQuery[0].file;

    // If path is being updated, check for conflicts
    if (input.path && input.path !== existingFile.path) {
      const conflictingFiles = await db.select()
        .from(projectFilesTable)
        .where(
          and(
            eq(projectFilesTable.project_id, existingFile.project_id),
            eq(projectFilesTable.path, input.path)
          )
        )
        .execute();

      if (conflictingFiles.length > 0) {
        throw new Error('A file with this path already exists in the project');
      }
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.path !== undefined) {
      updateData.path = input.path;
    }
    if (input.content !== undefined) {
      updateData.content = input.content;
    }
    if (input.file_type !== undefined) {
      updateData.file_type = input.file_type;
    }
    if (input.parent_id !== undefined) {
      updateData.parent_id = input.parent_id;
    }

    // Update the file
    const result = await db.update(projectFilesTable)
      .set(updateData)
      .where(eq(projectFilesTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Project file update failed:', error);
    throw error;
  }
};