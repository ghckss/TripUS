import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, it } from 'vitest';

import { ApiStack } from '../lib/api-stack.js';
import { DataStack } from '../lib/data-stack.js';
import type { StageConfig } from '../lib/stage-config.js';

const config: StageConfig = {
  aiPlannerProvider: 'mock',
  authMode: 'development',
  mapsProvider: 'mock',
  maxApiEnvironments: 2,
  maxApiRequestsPerSecond: 100,
  production: false,
  stage: 'test',
};

describe('TripUS infrastructure', () => {
  it('keeps stateful resources private and retained', () => {
    const app = new App();
    const stack = new DataStack(app, 'Data', { config });
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::RDS::DBCluster', {
      DatabaseName: 'tripus',
      DeletionProtection: true,
      EnableIAMDatabaseAuthentication: true,
      ServerlessV2ScalingConfiguration: { MaxCapacity: 2, MinCapacity: 0.5 },
      StorageEncrypted: true,
    });
    template.resourceCountIs('AWS::EC2::FlowLog', 1);
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: Match.anyValue(),
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      VersioningConfiguration: { Status: 'Enabled' },
    });
  });

  it('deploys NestJS as a Node.js 24 Web Function behind a constrained endpoint', () => {
    const app = new App();
    const data = new DataStack(app, 'Data', { config });
    const stack = new ApiStack(app, 'Api', {
      apiArtifactPath: new URL('fixtures/api.zip', import.meta.url).pathname,
      config,
      data,
    });
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Lambda::WebFunctionRevision', {
      BuildConfig: { RuntimeConfig: { Runtime: 'nodejs24.x' } },
      ServiceConfig: Match.objectLike({
        MaxConcurrencyPerEnvironment: 8,
        TimeoutSeconds: 60,
      }),
    });
    template.hasResourceProperties('AWS::Lambda::WebFunctionEndpoint', {
      AuthType: 'ApplicationManaged',
      EndpointType: 'HomeRegion',
      ScalingConfig: { MaxEnvironments: 2 },
      ThrottleConfig: { RateLimit: 100 },
    });
    template.hasResourceProperties('AWS::Lambda::Function', {
      Architectures: ['arm64'],
      Handler: 'dist/database/migration-handler.handler',
      Runtime: 'nodejs24.x',
      Timeout: 300,
    });
    template.resourceCountIs('AWS::CloudFormation::CustomResource', 1);
  });
});
