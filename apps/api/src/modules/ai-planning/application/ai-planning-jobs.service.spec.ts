import { describe, expect, it, vi } from 'vitest';

import { TravelDensity, TravelTheme } from '../domain/ai-planner.port';
import { AiPlanGenerationJobStatus, type AiPlanGenerationEntity } from '../domain/entities/ai-plan-generation.entity';
import { AiPlanningJobsService } from './ai-planning-jobs.service';
import { AiPlanGenerationStatus, AiTransportMode } from './dto/generate-ai-plan.dto';

const request = {
  density: TravelDensity.Balanced,
  themes: [TravelTheme.Highlights],
  transportModes: [AiTransportMode.PublicTransit],
};

describe('AiPlanningJobsService', () => {
  it('returns a job id before generation completes and persists the terminal status', async () => {
    let resolveGeneration!: (value: Record<string, unknown>) => void;
    const generation = new Promise<Record<string, unknown>>((resolve) => { resolveGeneration = resolve; });
    const generate = vi.fn().mockReturnValue(generation);
    const { service, records } = createService(generate);

    await expect(service.start('trip-1', request)).resolves.toEqual({
      generationId: 'generation-1',
      status: 'running',
    });
    await vi.waitFor(() => expect(generate).toHaveBeenCalledWith('trip-1', request, undefined));
    expect(records[0]?.status).toBe(AiPlanGenerationJobStatus.Running);

    resolveGeneration({
      status: AiPlanGenerationStatus.Generated,
      failureReason: null,
    });
    await vi.waitFor(() => expect(records[0]?.status).toBe(AiPlanGenerationJobStatus.Generated));
    await expect(service.getStatus('trip-1')).resolves.toEqual({
      generationId: 'generation-1',
      status: 'generated',
      failureReason: null,
    });
  });

  it('resumes a persisted running job when status is queried after a process restart', async () => {
    const generate = vi.fn().mockResolvedValue({
      status: AiPlanGenerationStatus.Generated,
      failureReason: null,
    });
    const running = createJob({ status: AiPlanGenerationJobStatus.Running, startedAt: new Date() });
    const { service, records } = createService(generate, [running]);

    await expect(service.getStatus('trip-1')).resolves.toEqual({
      generationId: 'generation-1',
      status: 'running',
      failureReason: null,
    });
    await vi.waitFor(() => expect(generate).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(records[0]?.status).toBe(AiPlanGenerationJobStatus.Generated));
  });
});

function createService(generate: ReturnType<typeof vi.fn>, initial: AiPlanGenerationEntity[] = []) {
  const records = [...initial];
  const jobs = {
    create: vi.fn((input: Partial<AiPlanGenerationEntity>) => createJob(input)),
    save: vi.fn((job: AiPlanGenerationEntity) => {
      const index = records.findIndex((record) => record.id === job.id);
      if (index >= 0) records[index] = job;
      else records.push(job);
      job.updatedAt = new Date();
      return Promise.resolve(job);
    }),
    findOne: vi.fn((options: { where: { status?: unknown } }) => {
      if (options.where.status) {
        return Promise.resolve(records.find((record) => record.status === AiPlanGenerationJobStatus.Queued || record.status === AiPlanGenerationJobStatus.Running) ?? null);
      }
      return Promise.resolve(records.at(-1) ?? null);
    }),
    findOneBy: vi.fn(({ id }: { id: string }) => Promise.resolve(records.find((record) => record.id === id) ?? null)),
  };
  const service = new AiPlanningJobsService(
    jobs as never,
    { findOneBy: vi.fn().mockResolvedValue({ id: 'trip-1', ownerId: 'user-1', active: true, startDate: '2026-11-01', endDate: '2026-11-03' }) } as never,
    { generate, getLatestRequest: vi.fn() } as never,
    { getCurrentUserId: () => 'user-1' },
  );
  return { service, records };
}

function createJob(overrides: Partial<AiPlanGenerationEntity> = {}): AiPlanGenerationEntity {
  return {
    id: 'generation-1',
    tripId: 'trip-1',
    ownerId: 'user-1',
    request,
    targetDate: null,
    status: AiPlanGenerationJobStatus.Queued,
    failureReason: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
