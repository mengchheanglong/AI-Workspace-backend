export interface CreateAuditLogDto {
  projectId?: string | null;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  requestId?: string | null;
}
