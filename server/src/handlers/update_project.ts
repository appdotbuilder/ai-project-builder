import { db } from '../db';
import { projectsTable } from '../db/schema';
import { type UpdateProjectInput, type Project } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function updateProject(input: UpdateProjectInput, userId: number): Promise<Project> {
  try {
    // First, verify that the project exists and belongs to the authenticated user
    const existingProject = await db.select()
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.id, input.id),
          eq(projectsTable.user_id, userId)
        )
      )
      .execute();

    if (existingProject.length === 0) {
      throw new Error('Project not found or access denied');
    }

    // Build the update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }

    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    if (input.metadata !== undefined) {
      updateData.metadata = input.metadata;
    }

    // Update the project
    const result = await db.update(projectsTable)
      .set(updateData)
      .where(
        and(
          eq(projectsTable.id, input.id),
          eq(projectsTable.user_id, userId)
        )
      )
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Failed to update project');
    }

    // Convert the database result to match our schema types
    const project = result[0];
    return {
      ...project,
      metadata: project.metadata as Record<string, any> | null
    };
  } catch (error) {
    console.error('Project update failed:', error);
    throw error;
  }
}