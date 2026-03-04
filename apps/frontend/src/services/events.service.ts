import api from './api';
import {
  GetEventsQuery,
  GetEventsResponse,
  ExposureReport,
  ShockSimulationResult,
} from '../../../shared/types/event.types';

export const eventsService = {
  async getEvents(query: GetEventsQuery = {}): Promise<GetEventsResponse> {
    const params = new URLSearchParams();

    if (query.since) params.set('since', query.since);
    if (query.limit != null) params.set('limit', String(query.limit));
    if (query.offset != null) params.set('offset', String(query.offset));

    if (query.severity) {
      const severities = Array.isArray(query.severity)
        ? query.severity
        : [query.severity];
      severities.forEach((s) => params.append('severity', s));
    }

    if (query.eventType) {
      const types = Array.isArray(query.eventType)
        ? query.eventType
        : [query.eventType];
      types.forEach((t) => params.append('eventType', t));
    }

    const { data } = await api.get<GetEventsResponse>(
      `/events?${params}`
    );

    return data;
  },

  async getExposure(): Promise<ExposureReport> {
    const { data } = await api.get<{ exposure: ExposureReport }>(
      '/events/exposure'
    );
    return data.exposure;
  },

  async simulateShock(eventId: number): Promise<ShockSimulationResult> {
    const { data } = await api.post<ShockSimulationResult>(
      '/events/simulate',
      { eventId }
    );
    return data;
  },
};