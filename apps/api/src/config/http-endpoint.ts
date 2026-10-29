export function resolveHttpEndpoint(environment: NodeJS.ProcessEnv): { host: string; port: number } {
  const lambdaEndpoint = environment.AWS_LAMBDA_HTTP_ENDPOINT;
  if (!lambdaEndpoint) {
    return { host: '0.0.0.0', port: Number(environment.PORT ?? 3000) };
  }

  const endpointUrl = new URL(`http://${lambdaEndpoint}`);
  return {
    host: endpointUrl.hostname,
    port: Number(endpointUrl.port),
  };
}
