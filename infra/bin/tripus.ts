#!/usr/bin/env node
import { resolve } from 'node:path';

import { App, Aspects, DefaultStackSynthesizer, Tags, Validations } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';

import { ApiStack } from '../lib/api-stack.js';
import { DataStack } from '../lib/data-stack.js';
import { loadStageConfig } from '../lib/stage-config.js';

const app = new App();
const config = loadStageConfig(app);
const environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-2',
};
const stackSynthesizer = () =>
  config.production
    ? new DefaultStackSynthesizer({ qualifier: 'tripusprod' })
    : undefined;

const data = new DataStack(app, `TripUs-${config.stage}-Data`, {
  config,
  description: `TripUS ${config.stage} stateful infrastructure`,
  env: environment,
  synthesizer: stackSynthesizer(),
  terminationProtection: true,
});
const api = new ApiStack(app, `TripUs-${config.stage}-Api`, {
  apiArtifactPath: resolve(import.meta.dirname, '../.artifacts/tripus-api.zip'),
  config,
  data,
  description: `TripUS ${config.stage} Lambda Web Function API`,
  env: environment,
  synthesizer: stackSynthesizer(),
});
api.addStackDependency(data);
Validations.of(data.databaseProxy.node.findChild('ProxyTargetGroup')).acknowledge({
  id: 'CloudFormation-Validate::F3002',
  reason: 'The generated DB proxy target group tags are accepted by CloudFormation; the bundled validator schema is stale.',
});

Tags.of(app).add('Application', 'TripUS');
Tags.of(app).add('Environment', config.stage);
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

app.synth();
