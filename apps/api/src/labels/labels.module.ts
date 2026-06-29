import { Module } from '@nestjs/common';

/**
 * Label CRUD lives on the projects controller (`/projects/:key/labels`), since
 * labels are always scoped to a project. This module exists as a named seam so
 * label-specific endpoints (bulk ops, recolor, delete) can grow here later
 * without reshuffling the projects module.
 */
@Module({})
export class LabelsModule {}
