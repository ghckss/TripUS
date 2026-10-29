import createClient, { type ClientOptions } from 'openapi-fetch';

import type { paths } from './schema';

export interface TripUsApiClientOptions
  extends Omit<ClientOptions, 'baseUrl'> {
  baseUrl: string;
}

export function createTripUsApiClient(options: TripUsApiClientOptions) {
  return createClient<paths>({
    ...options,
    baseUrl: options.baseUrl.replace(/\/$/, ''),
  });
}

export type TripUsApiClient = ReturnType<typeof createTripUsApiClient>;
