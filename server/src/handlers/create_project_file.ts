import { db } from '../db';
import { projectsTable, projectFilesTable } from '../db/schema';
import { type CreateProjectFileInput, type ProjectFile } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function createProjectFile(input: CreateProjectFileInput, userId: number): Promise<ProjectFile> {
  try {
    // 1. Verify that the project belongs to the authenticated user
    const projects = await db.select()
      .from(projectsTable)
      .where(and(
        eq(projectsTable.id, input.project_id),
        eq(projectsTable.user_id, userId)
      ))
      .execute();

    if (projects.length === 0) {
      throw new Error('Project not found or access denied');
    }

    // 2. Validate that the file path doesn't already exist in the project
    const existingFiles = await db.select()
      .from(projectFilesTable)
      .where(and(
        eq(projectFilesTable.project_id, input.project_id),
        eq(projectFilesTable.path, input.path)
      ))
      .execute();

    if (existingFiles.length > 0) {
      throw new Error('File path already exists in project');
    }

    // 3. If parent_id is provided, verify it exists and is a directory
    if (input.parent_id !== null && input.parent_id !== undefined) {
      const parentFiles = await db.select()
        .from(projectFilesTable)
        .where(and(
          eq(projectFilesTable.id, input.parent_id),
          eq(projectFilesTable.project_id, input.project_id)
        ))
        .execute();

      if (parentFiles.length === 0) {
        throw new Error('Parent directory not found');
      }

      if (parentFiles[0].file_type !== 'directory') {
        throw new Error('Parent must be a directory');
      }
    }

    // 4. Create the new file/directory record in the database
    const result = await db.insert(projectFilesTable)
      .values({
        project_id: input.project_id,
        path: input.path,
        content: input.content,
        file_type: input.file_type,
        parent_id: input.parent_id
      })
      .returning()
      .execute();

    // 5. Return the created file data
    return result[0];
  } catch (error) {
    console.error('Project file creation failed:', error);
    throw error;
  }
}