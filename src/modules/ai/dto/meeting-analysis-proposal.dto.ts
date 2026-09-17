import { z } from 'zod';
import { Priority } from '../../requirements/entities/requirement.entity';
import { DecisionStatus } from '../../decisions/entities/decision.entity';

export const MeetingDecisionDraftSchema = z.object({
  itemId: z.string().min(1),
  title: z.string().min(1).max(500),
  decisionText: z.string().min(1),
  rationale: z.string().nullable().optional(),
  status: z
    .enum([DecisionStatus.PROPOSED, DecisionStatus.ACCEPTED])
    .default(DecisionStatus.PROPOSED),
});

export type MeetingDecisionDraft = z.infer<typeof MeetingDecisionDraftSchema>;

export const MeetingRequirementDraftSchema = z.object({
  itemId: z.string().min(1),
  title: z.string().min(1).max(500),
  description: z.string().nullable().optional(),
  acceptanceCriteria: z.string().nullable().optional(),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
});

export type MeetingRequirementDraft = z.infer<typeof MeetingRequirementDraftSchema>;

export const MeetingActionItemDraftSchema = z.object({
  itemId: z.string().min(1),
  title: z.string().min(1).max(500),
  description: z.string().nullable().optional(),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  suggestedAssigneeEmail: z.string().email().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export type MeetingActionItemDraft = z.infer<typeof MeetingActionItemDraftSchema>;

export const MeetingAnalysisPayloadSchema = z.object({
  type: z.literal('MEETING_ANALYSIS'),
  summary: z.string().min(1),
  decisions: z.array(MeetingDecisionDraftSchema).default([]),
  requirements: z.array(MeetingRequirementDraftSchema).default([]),
  actionItems: z.array(MeetingActionItemDraftSchema).default([]),
});

export type MeetingAnalysisPayload = z.infer<typeof MeetingAnalysisPayloadSchema>;
