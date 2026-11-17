import { render, screen } from '@testing-library/react-native';
import type { ItineraryActivity, ItineraryItem } from '../../api/itineraries.api';
import { DayActivityTimeline, mergeDayTimeline, timeRange, timelineMapItems } from './day-activity-timeline';

jest.mock('./use-transit-leg', () => ({ useTransitLeg: () => ({ status: 'available', durationMinutes: 18 }) }));

const activity: ItineraryActivity = {
  id: 'arrival', date: '2026-12-01', position: 0, type: 'arrival', title: '입국 및 수하물 수령', startTime: '12:00', durationMinutes: 90,
  locationType: 'start_point', savedPlaceId: null, locationName: 'CDG', fromLocation: null, toLocation: null, travelMethod: null,
};
const places = [
  { id: 'airport', placeName: 'CDG', position: 0, scheduledTime: '12:00' },
  { id: 'visit', placeName: '에펠탑', activitySummary: '파리를 대표하는 철제 전망탑', position: 1, scheduledTime: '17:00', durationMinutes: 90 },
  { id: 'hotel', placeName: '호텔', position: 2, scheduledTime: null },
] as ItineraryItem[];
const activities = [
  activity,
  { ...activity, id: 'transfer', type: 'transport' as const, position: 1, startTime: '13:30', title: '숙소 이동', fromLocation: 'CDG', toLocation: '호텔', travelMethod: '택시 (추정)' },
  { ...activity, id: 'luggage', type: 'luggage' as const, position: 2, startTime: '15:00', durationMinutes: 30, title: '짐 보관' },
];
it('keeps current place order and preserves day boundaries without inserting legacy activities', () => {
  expect(mergeDayTimeline(places, activities, 'airport', 'hotel').map((entry) => entry.id)).toEqual(['airport', 'visit', 'hotel']);
});
it('shows places and timed activities without transport methods or estimate explanations', async () => {
  await render(<DayActivityTimeline tripId="timeline-test" items={places} activities={activities} startId='airport' endId='hotel' onPlacePress={jest.fn()} />);
  expect(screen.queryByText(/입국|짐 보관|휴식|대기/)).toBeNull();
  expect(screen.getAllByText('18분')[0]).toBeTruthy();
  expect(screen.queryByText('CDG → 호텔')).toBeNull();
  expect(screen.getByText('파리를 대표하는 철제 전망탑')).toBeTruthy();
  expect(screen.queryByText(/택시|추정|예상 소요시간/)).toBeNull();
});
it('formats activities ending after midnight without silently moving them earlier', () => {
  expect(timeRange('23:30', 90)).toBe('23:30–다음 날 01:00 · 90분');
});

it('does not insert hotel activity stops between airport and sightseeing on the map', () => {
  const hotel = { id: 'hotel-place', name: '호텔', latitude: 48.8, longitude: 2.3, address: 'Paris' } as never;
  const hotelStop = { ...activities[2], savedPlaceId: 'hotel-place' };
  expect(timelineMapItems(places, [hotelStop], [hotel], 'airport', 'hotel').map((item) => item.id)).toEqual(['airport', 'visit', 'hotel']);
});

it('ends at the hotel after travel, without extending the day for an old hotel rest activity', () => {
  const result = mergeDayTimeline(places, [
    ...activities,
    { ...activity, id: 'return', type: 'transport', startTime: '18:30', durationMinutes: 30, position: 5 },
    { ...activity, id: 'rest', type: 'rest', startTime: '19:00', durationMinutes: 120, position: 6, locationType: 'lodging' },
    { ...activity, id: 'wait', type: 'waiting', startTime: '21:00', durationMinutes: 30, position: 7 },
  ], 'airport', 'hotel');
  expect(result.map((entry) => entry.id)).toEqual(['airport', 'visit', 'hotel']);
  expect(result.at(-1)).toMatchObject({ time: null });
});

it('keeps reordered position authoritative even when scheduled times still reflect the previous order', () => {
  const reordered = [places[0], { ...places[1], position: 2, scheduledTime: '09:00' },
    { ...places[1], id: 'second-visit', position: 1, scheduledTime: '16:00' }, { ...places[2], position: 3 }];
  const expected = ['airport', 'second-visit', 'visit', 'hotel'];
  expect(mergeDayTimeline(reordered, activities, 'airport', 'hotel').map((entry) => entry.id)).toEqual(expected);
  expect(timelineMapItems(reordered, activities, [], 'airport', 'hotel').map((entry) => entry.id)).toEqual(expected);
});
