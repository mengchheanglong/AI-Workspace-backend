import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { OutboxEvent } from './entities/outbox-event.entity';

export interface EmitEventParams {
  projectId: string;
  eventType: string;
  payload: Record<string, unknown>;
  dedupeKey: string;
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private isProcessing = false;
  private eventHandler?: (event: OutboxEvent) => Promise<void>;

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepository: Repository<OutboxEvent>,
  ) {}

  setEventHandler(handler: (event: OutboxEvent) => Promise<void>): void {
    this.eventHandler = handler;
  }

  async emit(params: EmitEventParams): Promise<OutboxEvent>;
  async emit(manager: EntityManager, params: EmitEventParams): Promise<OutboxEvent>;
  async emit(
    managerOrParams: EntityManager | EmitEventParams,
    maybeParams?: EmitEventParams,
  ): Promise<OutboxEvent> {
    const isManager =
      managerOrParams && typeof (managerOrParams as EntityManager).getRepository === 'function';
    const manager = isManager ? (managerOrParams as EntityManager) : undefined;
    const params = isManager ? maybeParams! : (managerOrParams as EmitEventParams);

    const existing = manager
      ? await manager.findOne(OutboxEvent, { where: { dedupeKey: params.dedupeKey } })
      : await this.outboxRepository.findOne({ where: { dedupeKey: params.dedupeKey } });

    if (existing) {
      this.logger.debug(`Outbox dedupe key ${params.dedupeKey} already exists. Skipping.`);
      return existing;
    }

    const event = manager
      ? manager.create(OutboxEvent, {
          projectId: params.projectId,
          eventType: params.eventType,
          payload: params.payload,
          dedupeKey: params.dedupeKey,
          attempts: 0,
          dispatchedAt: null,
          lastError: null,
        })
      : this.outboxRepository.create({
          projectId: params.projectId,
          eventType: params.eventType,
          payload: params.payload,
          dedupeKey: params.dedupeKey,
          attempts: 0,
          dispatchedAt: null,
          lastError: null,
        });

    const saved = manager
      ? await manager.save(OutboxEvent, event)
      : await this.outboxRepository.save(event);

    // Schedule immediate asynchronous processing
    setImmediate(() => {
      void (async () => {
        try {
          await this.processPending();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`Error in outbox background dispatch: ${msg}`);
        }
      })();
    });

    return saved;
  }

  async processPending(limit = 20): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const events = await this.outboxRepository
        .createQueryBuilder('event')
        .where('event.dispatched_at IS NULL')
        .andWhere('event.attempts < 5')
        .orderBy('event.created_at', 'ASC')
        .take(limit)
        .getMany();

      let processedCount = 0;

      for (const event of events) {
        try {
          if (this.eventHandler) {
            await this.eventHandler(event);
          }
          event.dispatchedAt = new Date();
          event.lastError = null;
          await this.outboxRepository.save(event);
          processedCount++;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          event.attempts += 1;
          event.lastError = message;
          await this.outboxRepository.save(event);
          this.logger.warn(
            `Outbox event ${event.id} (type: ${event.eventType}) failed attempt ${event.attempts}: ${message}`,
          );
        }
      }

      return processedCount;
    } finally {
      this.isProcessing = false;
    }
  }
}
