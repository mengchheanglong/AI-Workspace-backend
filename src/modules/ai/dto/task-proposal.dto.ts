import { z } from 'zod';
import { Priority } from '../../requirements/entities/requirement.entity';

export const TaskDraftItemSchema = z.object({
  itemId: z.string().min(1),
  title: z.string().min(1).max(500),
  description: z.string().nullable().optional(),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  sourceIds: z.array(z.string()).default([]),
});

export type TaskDraftItem = z.infer<typeof TaskDraftItemSchema>;

export const TaskProposalPayloadSchema = z.object({
  type: z.literal('CREATE_TASKS'),
  items: z.array(TaskDraftItemSchema).min(1).max(20),
});

export type TaskProposalPayload = z.infer<typeof TaskProposalPayloadSchema>;
