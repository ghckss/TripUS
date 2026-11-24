import { BadRequestException, HttpException, Inject, Injectable, NotFoundException, Scope } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { TripEntity } from '../../trips/domain/entities/trip.entity';
import { AiPlanGenerationEntity, AiPlanGenerationJobStatus } from '../domain/entities/ai-plan-generation.entity';
import { AiPlanningService } from './ai-planning.service';
import { TravelTheme } from '../domain/ai-planner.port';
import {
  AiPlanExecutionStatus,
  type AiPlanExecutionStatusResponseDto,
  AiPlanGenerationStatus,
  AiTransportMode,
  type GenerateAiPlanDto,
  type StartAiPlanGenerationResponseDto,
} from './dto/generate-ai-plan.dto';

const ACTIVE_JOB_STATUSES = [AiPlanGenerationJobStatus.Queued, AiPlanGenerationJobStatus.Running];

@Injectable({ scope: Scope.REQUEST })
export class AiPlanningJobsService {
  private static readonly activeJobs = new Set<string>();

  constructor(
    @InjectRepository(AiPlanGenerationEntity) private readonly jobs: Repository<AiPlanGenerationEntity>,
    @InjectRepository(TripEntity) private readonly trips: Repository<TripEntity>,
    @Inject(AiPlanningService) private readonly planning: AiPlanningService,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
  ) {}

  async startDay(tripId: string, date: string): Promise<StartAiPlanGenerationResponseDto> {
    const latest = await this.planning.getLatestRequest(tripId);
    return this.start(tripId, latest.request ?? {
      themes: [TravelTheme.Highlights],
      transportModes: [AiTransportMode.PublicTransit, AiTransportMode.Walking],
    }, date);
  }

  async start(tripId: string, request: GenerateAiPlanDto, targetDate: string | null = null): Promise<StartAiPlanGenerationResponseDto> {
    const ownerId = this.identity.getCurrentUserId();
    const trip = await this.trips.findOneBy({ id: tripId, ownerId, active: true });
    if (!trip) throw new NotFoundException('Trip not found');
    if (targetDate && (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || targetDate < trip.startDate || targetDate > trip.endDate)) {
      throw new BadRequestException('AI_PLAN_DATE_OUT_OF_RANGE');
    }

    const existing = await this.jobs.findOne({
      where: { tripId, ownerId, status: In(ACTIVE_JOB_STATUSES) },
      order: { createdAt: 'DESC' },
    });
    if (existing) {
      this.runInBackground(existing);
      return { generationId: existing.id, status: AiPlanExecutionStatus.Running };
    }

    let job: AiPlanGenerationEntity;
    try {
      job = await this.jobs.save(this.jobs.create({
        tripId,
        ownerId,
        request: { ...request },
        targetDate,
        status: AiPlanGenerationJobStatus.Queued,
        failureReason: null,
        startedAt: null,
        completedAt: null,
      }));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const concurrentlyCreated = await this.jobs.findOne({
        where: { tripId, ownerId, status: In(ACTIVE_JOB_STATUSES) },
        order: { createdAt: 'DESC' },
      });
      if (!concurrentlyCreated) throw error;
      job = concurrentlyCreated;
    }
    this.runInBackground(job);
    return { generationId: job.id, status: AiPlanExecutionStatus.Running };
  }

  async getStatus(tripId: string): Promise<AiPlanExecutionStatusResponseDto> {
    const ownerId = this.identity.getCurrentUserId();
    const trip = await this.trips.findOneBy({ id: tripId, ownerId, active: true });
    if (!trip) throw new NotFoundException('Trip not found');
    const job = await this.jobs.findOne({ where: { tripId, ownerId }, order: { createdAt: 'DESC' } });
    if (!job) return { generationId: null, status: AiPlanExecutionStatus.Idle, failureReason: null };
    if (ACTIVE_JOB_STATUSES.includes(job.status)) this.runInBackground(job);
    return {
      generationId: job.id,
      status: toExecutionStatus(job.status),
      failureReason: job.failureReason,
    };
  }

  private runInBackground(job: AiPlanGenerationEntity): void {
    if (AiPlanningJobsService.activeJobs.has(job.id)) return;
    AiPlanningJobsService.activeJobs.add(job.id);
    void this.execute(job.id).finally(() => AiPlanningJobsService.activeJobs.delete(job.id));
  }

  private async execute(jobId: string): Promise<void> {
    const job = await this.jobs.findOneBy({ id: jobId, ownerId: this.identity.getCurrentUserId() });
    if (!job || !ACTIVE_JOB_STATUSES.includes(job.status)) return;
    job.status = AiPlanGenerationJobStatus.Running;
    job.startedAt ??= new Date();
    job.failureReason = null;
    await this.jobs.save(job);
    try {
      const result = await this.planning.generate(job.tripId, job.request, job.targetDate ?? undefined);
      job.status = result.status === AiPlanGenerationStatus.Generated
        ? AiPlanGenerationJobStatus.Generated
        : result.status === AiPlanGenerationStatus.Conflict
          ? AiPlanGenerationJobStatus.Conflict
          : AiPlanGenerationJobStatus.Unavailable;
      job.failureReason = result.failureReason;
    } catch (error) {
      job.status = AiPlanGenerationJobStatus.Unavailable;
      job.failureReason = jobFailureReason(error);
    } finally {
      job.completedAt = new Date();
      await this.jobs.save(job);
    }
  }
}

function jobFailureReason(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'object' && response !== null && 'code' in response && typeof response.code === 'string') {
      return response.code.slice(0, 120);
    }
  }
  return error instanceof Error ? error.message.slice(0, 120) : 'provider_failure';
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'driverError' in error
    && typeof error.driverError === 'object'
    && error.driverError !== null
    && 'code' in error.driverError
    && error.driverError.code === '23505';
}

function toExecutionStatus(status: AiPlanGenerationJobStatus): AiPlanExecutionStatus {
  if (status === AiPlanGenerationJobStatus.Generated) return AiPlanExecutionStatus.Generated;
  if (status === AiPlanGenerationJobStatus.Conflict) return AiPlanExecutionStatus.Conflict;
  if (status === AiPlanGenerationJobStatus.Unavailable) return AiPlanExecutionStatus.Unavailable;
  return AiPlanExecutionStatus.Running;
}
