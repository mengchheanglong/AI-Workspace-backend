import { ExtractedDocument } from './text-extractor.interface';

export class EntityExtractor {
  extractRequirement(req: {
    id: string;
    title: string;
    type?: string;
    priority?: string;
    status?: string;
    description?: string | null;
    acceptanceCriteria?: string | null;
    rationale?: string | null;
  }): ExtractedDocument {
    const lines: string[] = [
      `Requirement: ${req.title}`,
      `Type: ${req.type ?? 'N/A'} | Priority: ${req.priority ?? 'N/A'} | Status: ${req.status ?? 'N/A'}`,
    ];

    const sections: { title?: string; content: string }[] = [];

    if (req.description) {
      lines.push(`\nDescription:\n${req.description}`);
      sections.push({ title: 'Description', content: req.description });
    }

    if (req.acceptanceCriteria) {
      lines.push(`\nAcceptance Criteria:\n${req.acceptanceCriteria}`);
      sections.push({ title: 'Acceptance Criteria', content: req.acceptanceCriteria });
    }

    if (req.rationale) {
      lines.push(`\nRationale:\n${req.rationale}`);
      sections.push({ title: 'Rationale', content: req.rationale });
    }

    const text = lines.join('\n');
    return {
      text,
      sections: sections.length > 0 ? sections : [{ content: text }],
      metadata: {
        charCount: text.length,
        sourceType: 'REQUIREMENT',
        sourceId: req.id,
        title: req.title,
      },
    };
  }

  extractDecision(decision: {
    id: string;
    title: string;
    status?: string;
    category?: string;
    context?: string | null;
    decision?: string | null;
    consequences?: string | null;
  }): ExtractedDocument {
    const lines: string[] = [
      `Decision: ${decision.title}`,
      `Status: ${decision.status ?? 'N/A'} | Category: ${decision.category ?? 'N/A'}`,
    ];

    const sections: { title?: string; content: string }[] = [];

    if (decision.context) {
      lines.push(`\nContext:\n${decision.context}`);
      sections.push({ title: 'Context', content: decision.context });
    }

    if (decision.decision) {
      lines.push(`\nDecision Taken:\n${decision.decision}`);
      sections.push({ title: 'Decision Taken', content: decision.decision });
    }

    if (decision.consequences) {
      lines.push(`\nConsequences:\n${decision.consequences}`);
      sections.push({ title: 'Consequences', content: decision.consequences });
    }

    const text = lines.join('\n');
    return {
      text,
      sections: sections.length > 0 ? sections : [{ content: text }],
      metadata: {
        charCount: text.length,
        sourceType: 'DECISION',
        sourceId: decision.id,
        title: decision.title,
      },
    };
  }

  extractTask(task: {
    id: string;
    title: string;
    description?: string | null;
    status?: string;
    priority?: string;
    dueDate?: string | Date | null;
  }): ExtractedDocument {
    const lines: string[] = [
      `Task: ${task.title}`,
      `Status: ${task.status ?? 'N/A'} | Priority: ${task.priority ?? 'N/A'} | Due: ${task.dueDate ? new Date(task.dueDate).toISOString() : 'None'}`,
    ];

    const sections: { title?: string; content: string }[] = [];

    if (task.description) {
      lines.push(`\nDescription:\n${task.description}`);
      sections.push({ title: 'Description', content: task.description });
    }

    const text = lines.join('\n');
    return {
      text,
      sections: sections.length > 0 ? sections : [{ content: text }],
      metadata: {
        charCount: text.length,
        sourceType: 'TASK',
        sourceId: task.id,
        title: task.title,
      },
    };
  }

  extractMeeting(meeting: {
    id: string;
    title: string;
    status?: string;
    scheduledAt?: string | Date | null;
    agenda?: string | null;
    notes?: string | null;
    actionItems?: unknown[] | null;
  }): ExtractedDocument {
    const lines: string[] = [
      `Meeting: ${meeting.title}`,
      `Status: ${meeting.status ?? 'N/A'} | Scheduled: ${meeting.scheduledAt ? new Date(meeting.scheduledAt).toISOString() : 'None'}`,
    ];

    const sections: { title?: string; content: string }[] = [];

    if (meeting.agenda) {
      lines.push(`\nAgenda:\n${meeting.agenda}`);
      sections.push({ title: 'Agenda', content: meeting.agenda });
    }

    if (meeting.notes) {
      lines.push(`\nNotes:\n${meeting.notes}`);
      sections.push({ title: 'Notes', content: meeting.notes });
    }

    if (meeting.actionItems && meeting.actionItems.length > 0) {
      const itemsText = meeting.actionItems
        .map((item) => {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item !== null && 'title' in item) {
            return String((item as { title: unknown }).title);
          }
          return JSON.stringify(item);
        })
        .map((text) => `- ${text}`)
        .join('\n');
      lines.push(`\nAction Items:\n${itemsText}`);
      sections.push({ title: 'Action Items', content: itemsText });
    }

    const text = lines.join('\n');
    return {
      text,
      sections: sections.length > 0 ? sections : [{ content: text }],
      metadata: {
        charCount: text.length,
        sourceType: 'MEETING',
        sourceId: meeting.id,
        title: meeting.title,
      },
    };
  }

  extractGitHubIssue(issue: {
    id: string;
    issueNumber: number;
    title: string;
    body?: string | null;
    state: string;
    htmlUrl: string;
    authorLogin?: string | null;
    labels?: string[] | null;
    repositoryOwner?: string;
    repositoryName?: string;
  }): ExtractedDocument {
    const repoInfo =
      issue.repositoryOwner && issue.repositoryName
        ? ` (${issue.repositoryOwner}/${issue.repositoryName})`
        : '';
    const lines: string[] = [
      `GitHub Issue #${issue.issueNumber}: ${issue.title}${repoInfo}`,
      `State: ${issue.state.toUpperCase()} | Author: ${issue.authorLogin ?? 'Unknown'} | URL: ${issue.htmlUrl}`,
    ];

    if (issue.labels && issue.labels.length > 0) {
      lines.push(`Labels: ${issue.labels.join(', ')}`);
    }

    const sections: { title?: string; content: string }[] = [];

    if (issue.body) {
      lines.push(`\nDescription:\n${issue.body}`);
      sections.push({ title: 'Description', content: issue.body });
    }

    const text = lines.join('\n');
    return {
      text,
      sections: sections.length > 0 ? sections : [{ content: text }],
      metadata: {
        charCount: text.length,
        sourceType: 'GITHUB_ISSUE',
        sourceId: issue.id,
        title: `[GitHub #${issue.issueNumber}] ${issue.title}`,
      },
    };
  }
}
