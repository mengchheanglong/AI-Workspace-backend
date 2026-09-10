import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Task, TaskStatus, Priority } from '../entities/task.entity';

export class TaskResponseDto {
  @ApiProperty({ example: 'f87a8f89-8d7b-4029-9fa9-6f9ec67bc9e3' })
  id!: string;

  @ApiProperty({ example: 'f87a8f89-8d7b-4029-9fa9-6f9ec67bc9e3' })
  projectId!: string;

  @ApiProperty({ example: 8 })
  number!: number;

  @ApiProperty({ example: 'AIW-TASK-8' })
  displayKey!: string;

  @ApiProperty({ example: 'Implement login API' })
  title!: string;

  @ApiPropertyOptional({ example: 'Set up endpoints and cookie sessions', nullable: true })
  description!: string | null;

  @ApiProperty({ enum: TaskStatus, example: TaskStatus.TODO })
  status!: TaskStatus;

  @ApiProperty({ enum: Priority, example: Priority.MEDIUM })
  priority!: Priority;

  @ApiPropertyOptional({ nullable: true })
  assigneeId!: string | null;

  @ApiPropertyOptional({ example: '2026-10-15', nullable: true })
  dueDate!: string | null;

  @ApiPropertyOptional({ nullable: true })
  requirementId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sourceMeetingId!: string | null;

  @ApiProperty()
  createdBy!: string;

  @ApiProperty()
  updatedBy!: string;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ example: '2026-09-10T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-09-10T10:00:00.000Z' })
  updatedAt!: string;

  static fromEntity(task: Task, projectKey: string): TaskResponseDto {
    return {
      id: task.id,
      projectId: task.projectId,
      number: task.number,
      displayKey: `${projectKey}-TASK-${task.number}`,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId,
      dueDate: task.dueDate,
      requirementId: task.requirementId,
      sourceMeetingId: task.sourceMeetingId,
      createdBy: task.createdBy,
      updatedBy: task.updatedBy,
      version: task.version,
      createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt,
      updatedAt: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : task.updatedAt,
    };
  }
}
