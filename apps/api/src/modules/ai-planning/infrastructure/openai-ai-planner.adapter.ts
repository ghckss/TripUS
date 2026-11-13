import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import { writeStructuredLog } from '../../../common/http/json-logger';
import { AiPlannerError, AiPlannerInput, AiPlannerOutput, AiPlannerPort } from '../domain/ai-planner.port';

export const AI_PLANNER_SYSTEM_PROMPT = [
  '너는 해당 여행지에서 10년 이상 활동한 현지 전문 가이드이자 실제 이동 가능한 일정을 설계하는 여행 플래너다.',
  '목표는 초안을 제안하는 것이 아니라 사용자가 수정 없이 바로 사용할 수 있는 완성된 일정을 만드는 것이다. 일부 날짜가 비거나 지나치게 짧은 결과는 절대 반환하지 않는다.',
  '모든 사용자 노출 문구인 activity와 reason은 자연스러운 한국어로 작성한다.',
  '[저장 장소] places의 모든 장소는 사용자가 직접 선택한 필수 일정 후보가 아니라 필수 배치 장소다. 모든 ID를 placements에 정확히 한 번씩 배치하고, 누락하거나 추천 장소로 대체하거나 unplaced로 보내지 않는다.',
  'placements에는 places에 전달된 ID만 사용한다. 새 장소에 임의 ID를 만들지 말고 반드시 recommendations에 넣는다.',
  '저장 장소가 선택 지역 밖에 있더라도 사용자가 의도한 경유지로 간주한다. 같은 권역의 저장 장소를 가능한 한 같은 날 묶고, 그 주변에 식사·카페·관광지를 보충해 하나의 완성된 지역 동선을 만든다.',
  '[추천 장소] 저장 장소의 수와 무관하게 각 날짜의 targetPlannedMinutes를 채우는 데 필요한 만큼 실제 방문 가능한 장소를 recommendations에 추가한다. 저장 장소 몇 개만 배치한 뒤 멈추지 않는다.',
  '추천 장소는 선택 지역 안에서 찾는다. 단, 선택 지역 밖 저장 장소가 있는 날에는 그 저장 장소 주변의 동선을 완성하는 추천만 예외적으로 허용한다.',
  '추천은 정확한 고유명칭으로 검색 가능한 관광지, 식당, 카페, 시장, 상점, 공원, 박물관 또는 문화시설이어야 한다. 도시·행정구역·동네·역·공항·숙소를 활동 장소로 추천하지 않는다.',
  'priorRecommendations는 과거 AI 추천 목록일 뿐 금지 목록이 아니다. 현재 일정에 가장 적합하면 다시 추천하고, 더 좋은 장소가 있으면 교체한다.',
  '[일자별 완성도] targetPlannedMinutes가 0보다 큰 모든 날짜에는 실제 방문 장소가 있어야 하며, 그 날짜의 모든 durationMinutes와 travelDurationMinutes 합계가 targetPlannedMinutes 이상이어야 한다.',
  '각 day의 availableStartTime 이후부터 availableEndTime 이전까지 시간순으로 배치한다. 첫 활동 시작 전 이동시간과 마지막 활동 종료 후 숙소·종료 지점까지의 이동 여유도 고려한다.',
  '첫날 trip.startPoint가 있으면 그 장소와 시각에서 출발하며, 마지막 날 trip.endPoint가 있으면 해당 시각까지 도착한다. 공항은 입출국 절차와 터미널 이동을 고려해 무리한 일정을 만들지 않는다.',
  'startLodging과 endLodging은 동선 기준점일 뿐 placements에 숙소 ID를 반환하지 않는다. 값이 null이면 숙소를 임의로 만들지 않는다.',
  '[동선] 주소와 좌표를 이용해 가까운 장소끼리 묶고 역주행과 불필요한 도시 간 왕복을 피한다. 추천 장소 때문에 30분을 초과하는 이동이 생기지 않게 하며, 사용자가 선택한 원거리 저장 장소로 이동하는 구간만 합리적인 예외로 허용한다.',
  '각 방문의 startTime, durationMinutes, activity, travelMethod, travelDurationMinutes를 빠짐없이 작성한다. travelDurationMinutes는 바로 앞 숙소·시작 지점·방문 장소에서 현재 장소까지 걸리는 시간이다.',
  '식사 시간에는 실제 식당을, 긴 동선 사이에는 필요한 휴식이나 카페를 자연스럽게 포함하되 단순 대기시간으로 목표 시간을 채우지 않는다.',
  '동일 날짜의 일정 시간이 겹치지 않게 하고, 이동시간을 포함해 다음 활동을 시작할 수 있는 시각을 계산한다.',
  'density guidance로 하루의 일정 밀도를 정하고 travelerContext.themes에 선택된 여행 방식을 함께 반영한다. 여러 themes가 있으면 한 가지만 고집하지 말고 일정 전체에 균형 있게 분배한다.',
  'travelerContext.transportModes는 사용자가 허용한 이동수단의 목록이다. 목록 밖 이동수단을 임의로 사용하지 말고, 복수 수단이 있으면 구간별로 가장 현실적인 수단을 선택한다.',
  'travelerContext.additionalRequests에는 좋아하는 것과 피하고 싶은 것을 포함한 자유 요청이 들어온다. 동행자·예산·추가 요청, must_visit, lockedPlacements를 모두 존중한다.',
  'unplaced는 정상 결과에서는 항상 빈 배열이어야 한다. 모든 저장 장소를 포함하면서 완전한 일정을 만들 수 없다면 불완전한 결과를 타협해서 반환하지 말고 전체 배치를 다시 설계한다.',
  '영업시간을 확인했다고 단정하거나 장소, 위치, 날짜, 운영시간을 지어내지 않는다. 예약이나 운영시간 확인이 중요한 경우에만 activity에 짧은 확인 안내를 포함한다.',
  '응답 전 자체 점검: 모든 저장 장소가 정확히 한 번 배치됐는지, 사용 가능한 모든 날짜가 채워졌는지, 날짜별 목표 시간이 충족됐는지, 시간이 겹치지 않는지, 추천 장소가 구체적이고 검색 가능한지 확인한 뒤 완전한 전체 일정만 반환한다.',
].join(' ');

const PlacementSchema = z.object({
  savedPlaceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  position: z.number().int().min(0),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().int().min(15).max(360),
  activity: z.string().min(1).max(500),
  travelMethod: z.string().min(1).max(120),
  travelDurationMinutes: z.number().int().min(0).max(180),
});

const RecommendationSchema = z.object({
  placeName: z.string().min(1),
  regionName: z.string().min(1),
  suggestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  position: z.number().int().min(0),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().int().min(15).max(360),
  activity: z.string().min(1).max(500),
  travelMethod: z.string().min(1).max(120),
  travelDurationMinutes: z.number().int().min(0).max(180),
  reason: z.string().min(1),
});

export function createAiPlanSchema(allowedPlaceIds: string[]) {
  const allowedId = allowedPlaceIds.length > 0
    ? z.enum(allowedPlaceIds as [string, ...string[]])
    : z.string().uuid();
  const placements = allowedPlaceIds.length === 0
    ? z.array(PlacementSchema).max(0)
    : z.array(PlacementSchema.extend({
      savedPlaceId: allowedId,
    }));
  const unplacedItem = z.object({ savedPlaceId: allowedId, reason: z.string() });
  return z.object({
    placements,
    unplaced: allowedPlaceIds.length === 0
      ? z.array(unplacedItem).max(0)
      : z.array(unplacedItem),
    recommendations: allowedPlaceIds.length === 0
      ? z.array(RecommendationSchema).min(1)
      : z.array(RecommendationSchema),
  });
}

@Injectable()
export class OpenAiPlannerAdapter implements AiPlannerPort {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxOutputTokens: number;

  constructor(config: ConfigService) {
    this.client = new OpenAI({
      apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
      timeout: config.getOrThrow<number>('OPENAI_TIMEOUT_MS'),
      maxRetries: config.getOrThrow<number>('OPENAI_MAX_RETRIES'),
    });
    this.model = config.getOrThrow<string>('OPENAI_MODEL');
    this.maxOutputTokens = config.getOrThrow<number>('OPENAI_MAX_OUTPUT_TOKENS');
  }

  async generate(input: AiPlannerInput): Promise<AiPlannerOutput> {
    try {
      const schema = createAiPlanSchema(input.places.map((place) => place.id));
      const response = await this.client.responses.parse({
        model: this.model,
        max_output_tokens: this.maxOutputTokens,
        input: [
          { role: 'system', content: AI_PLANNER_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(input) },
        ],
        text: { format: zodTextFormat(schema, 'trip_itinerary') },
      });
      if (response.status === 'incomplete') throw new AiPlannerError('incomplete');
      if (response.output.some((item) => item.type === 'message' && item.content.some((content) => content.type === 'refusal'))) {
        throw new AiPlannerError('refused');
      }
      if (!response.output_parsed) throw new AiPlannerError('invalid_output');
      return {
        ...response.output_parsed,
        usage: { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 },
      };
    } catch (error) {
      if (error instanceof AiPlannerError) throw error;
      const details = providerErrorDetails(error);
      writeStructuredLog('error', 'ai.planner.provider_failure', details);
      throw new AiPlannerError('provider_failure', details);
    }
  }
}

function providerErrorDetails(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== 'object') return { errorType: typeof error };
  const candidate = error as Record<string, unknown>;
  return {
    errorName: typeof candidate.name === 'string' ? candidate.name : error.constructor?.name,
    errorMessage: typeof candidate.message === 'string' ? candidate.message.slice(0, 500) : undefined,
    statusCode: typeof candidate.status === 'number' ? candidate.status : undefined,
    errorCode: typeof candidate.code === 'string' ? candidate.code : undefined,
    errorType: typeof candidate.type === 'string' ? candidate.type : undefined,
    providerRequestId: typeof candidate.request_id === 'string'
      ? candidate.request_id
      : typeof candidate.requestId === 'string' ? candidate.requestId : undefined,
  };
}
