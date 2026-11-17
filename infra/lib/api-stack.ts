import { CfnOutput, CustomResource, Duration, Fn, RemovalPolicy, Stack, Validations, type StackProps } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as customResources from 'aws-cdk-lib/custom-resources';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3deployment from 'aws-cdk-lib/aws-s3-deployment';
import * as sns from 'aws-cdk-lib/aws-sns';
import { NagSuppressions } from 'cdk-nag';
import type { Construct } from 'constructs';

import type { DataStack } from './data-stack.js';
import type { StageConfig } from './stage-config.js';

export interface ApiStackProps extends StackProps {
  readonly apiArtifactPath: string;
  readonly config: StageConfig;
  readonly data: DataStack;
}

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { config, data } = props;
    const functionName = `tripus-${config.stage}-api`;
    const logRemovalPolicy = config.production ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;
    const logGroup = new logs.LogGroup(this, 'ApiLogs', {
      logGroupName: `/aws/lambda/web/${functionName}`,
      removalPolicy: logRemovalPolicy,
      retention: config.production ? logs.RetentionDays.THREE_MONTHS : logs.RetentionDays.ONE_MONTH,
    });
    const localLogGroup = new logs.LogGroup(this, 'ApiLocalLogs', {
      logGroupName: `/aws/lambda/web/${functionName}.local`,
      removalPolicy: logRemovalPolicy,
      retention: config.production ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
    });

    const executionRole = new iam.Role(this, 'ApiExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'TripUS Lambda Web Function runtime permissions',
    });
    logGroup.grantWrite(executionRole);
    localLogGroup.grantWrite(executionRole);
    data.applicationDatabaseSecret.grantRead(executionRole);
    data.runtimeSecret.grantRead(executionRole);
    executionRole.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject'],
      resources: [data.photoBucket.arnForObjects('*')],
    }));
    NagSuppressions.addResourceSuppressions(executionRole, [{
      id: 'AwsSolutions-IAM5',
      reason: 'The API reads and writes dynamic per-user photo keys; object-level S3 ARNs necessarily contain a key wildcard.',
    }], true);

    const connectorOperatorRole = new iam.Role(this, 'ConnectorOperatorRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Allows Lambda to manage ENIs for the TripUS Web Function connector',
    });
    connectorOperatorRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'ec2:AssignPrivateIpAddresses',
        'ec2:CreateNetworkInterface',
        'ec2:DeleteNetworkInterface',
        'ec2:DescribeNetworkInterfaces',
        'ec2:DescribeSubnets',
        'ec2:UnassignPrivateIpAddresses',
      ],
      resources: ['*'],
    }));
    connectorOperatorRole.addToPolicy(new iam.PolicyStatement({
      actions: ['ec2:CreateTags'],
      conditions: {
        StringEquals: {
          'ec2:ManagedResourceOperator': 'network-connectors.lambda.amazonaws.com',
        },
      },
      resources: ['*'],
    }));
    NagSuppressions.addResourceSuppressions(connectorOperatorRole, [{
      id: 'AwsSolutions-IAM5',
      reason: 'Lambda network connector ENI lifecycle APIs do not support resource-level permissions and therefore require Resource *.',
    }], true);

    const connector = new lambda.CfnNetworkConnector(this, 'NetworkConnector', {
      configuration: {
        vpcEgressConfiguration: {
          associatedComputeResourceTypes: ['WebFunction'],
          networkProtocol: 'IPv4',
          securityGroupIds: [data.apiSecurityGroup.securityGroupId],
          subnetIds: data.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnetIds,
        },
      },
      name: `tripus-${config.stage}-api`,
      operatorRole: connectorOperatorRole.roleArn,
    });
    connector.node.addDependency(connectorOperatorRole.node.findChild('DefaultPolicy'));
    Validations.of(connector).acknowledge({
      id: 'CloudFormation-Validate::F3006',
      reason: 'AWS::Lambda::NetworkConnector is live in ap-northeast-2, but the bundled regional availability data has not caught up yet.',
    });

    const artifact = new s3deployment.BucketDeployment(this, 'ApiArtifact', {
      destinationBucket: data.codeBucket,
      destinationKeyPrefix: 'artifacts/api',
      extract: false,
      prune: false,
      sources: [s3deployment.Source.asset(props.apiArtifactPath)],
    });
    const artifactObjectKey = Fn.join('', ['artifacts/api/', Fn.select(0, artifact.objectKeys)]);
    NagSuppressions.addResourceSuppressions(artifact, [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'The CDK BucketDeployment provider owns this generated service role and its basic Lambda logging policy.',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'The CDK BucketDeployment provider must read generated asset keys and write versioned deployment keys in the destination prefix.',
      },
      {
        id: 'AwsSolutions-L1',
        reason: 'The Lambda runtime belongs to the current aws-cdk-lib BucketDeployment provider implementation, not application code.',
      },
    ], true);
    const bucketDeploymentProvider = this.node.findChild('Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C');
    NagSuppressions.addResourceSuppressions(bucketDeploymentProvider, [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'The CDK BucketDeployment provider owns this generated service role and its basic Lambda logging policy.',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'The CDK BucketDeployment provider must read generated asset keys and write versioned deployment keys in the destination prefix.',
      },
      {
        id: 'AwsSolutions-L1',
        reason: 'The Lambda runtime belongs to the current aws-cdk-lib BucketDeployment provider implementation, not application code.',
      },
    ], true);

    const migrationLogGroup = new logs.LogGroup(this, 'MigrationLogs', {
      removalPolicy: logRemovalPolicy,
      retention: config.production ? logs.RetentionDays.THREE_MONTHS : logs.RetentionDays.ONE_MONTH,
    });
    const migrationFunction = new lambda.Function(this, 'MigrationFunction', {
      architecture: lambda.Architecture.ARM_64,
      code: lambda.Code.fromBucket(
        data.codeBucket,
        artifactObjectKey,
      ),
      description: `TripUS ${config.stage} TypeORM deployment migrations`,
      environment: {
        DATABASE_NAME: 'tripus',
        DATABASE_PROXY_HOST: data.databaseProxy.endpoint,
        DATABASE_SECRET_ARN: data.databaseSecret.secretArn,
        APP_DATABASE_SECRET_ARN: data.applicationDatabaseSecret.secretArn,
        NODE_ENV: 'production',
      },
      handler: 'dist/database/migration-handler.handler',
      logGroup: migrationLogGroup,
      memorySize: 512,
      runtime: lambda.Runtime.NODEJS_24_X,
      securityGroups: [data.apiSecurityGroup],
      timeout: Duration.minutes(5),
      vpc: data.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });
    migrationFunction.node.addDependency(artifact);
    Validations.of(data.codeBucket).acknowledge({
      id: 'Annotation::@aws-cdk/aws-lambda:codeFromBucketObjectVersionNotSpecified',
      reason: 'The API artifact uses a content-addressed S3 object key, so every code change produces a new key without requiring a version ID.',
    });
    data.databaseSecret.grantRead(migrationFunction);
    data.applicationDatabaseSecret.grantRead(migrationFunction);
    NagSuppressions.addResourceSuppressions(migrationFunction, [{
      id: 'AwsSolutions-IAM4',
      reason: 'CDK attaches the AWS-managed Lambda basic execution and VPC access policies required by this deployment-only migration function.',
    }], true);

    const migrationProviderLogGroup = new logs.LogGroup(this, 'MigrationProviderLogs', {
      removalPolicy: logRemovalPolicy,
      retention: config.production ? logs.RetentionDays.THREE_MONTHS : logs.RetentionDays.ONE_MONTH,
    });
    const migrationProvider = new customResources.Provider(this, 'MigrationProvider', {
      logGroup: migrationProviderLogGroup,
      onEventHandler: migrationFunction,
    });
    NagSuppressions.addResourceSuppressions(migrationProvider, [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'The CDK Provider framework owns its generated Lambda service role and basic logging policy.',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'The CDK Provider framework must invoke the versioned migration function generated by this stack.',
      },
      {
        id: 'AwsSolutions-L1',
        reason: 'The provider framework runtime is managed by the current aws-cdk-lib implementation, not application code.',
      },
    ], true);
    const migration = new CustomResource(this, 'DatabaseMigration', {
      properties: { artifactKey: artifactObjectKey },
      serviceToken: migrationProvider.serviceToken,
    });
    migration.node.addDependency(migrationFunction);

    const webFunction = new lambda.CfnWebFunction(this, 'ApiFunction', {
      functionName,
      tags: [{ key: 'Stage', value: config.stage }],
    });
    Validations.of(webFunction).acknowledge({
      id: 'CloudFormation-Validate::F3006',
      reason: 'AWS::Lambda::WebFunction is a newly released CloudFormation resource not yet present in the bundled validation schema.',
    });
    const revision = new lambda.CfnWebFunctionRevision(this, 'ApiRevision', {
      buildConfig: {
        codeConfig: {
          s3Object: {
            bucket: data.codeBucket.bucketName,
            key: artifactObjectKey,
          },
        },
        runtimeConfig: { runtime: 'nodejs24.x' },
      },
      description: `TripUS ${config.stage} NestJS API`,
      functionName: webFunction.functionName,
      serviceConfig: {
        egressNetworkConnectorArn: connector.attrLatestVersionArn,
        environmentVariables: {
          AI_PLANNER_PROVIDER: config.aiPlannerProvider,
          AUTH_MODE: config.authMode,
          BILLING_PROVIDER: 'disabled',
          AWS_LAMBDA_NODEJS_ENTRYPOINT: 'dist/web-main.mjs',
          DATABASE_NAME: 'tripus',
          DATABASE_PROXY_HOST: data.databaseProxy.endpoint,
          DATABASE_SECRET_ARN: data.applicationDatabaseSecret.secretArn,
          MAPS_PROVIDER: config.mapsProvider,
          NODE_ENV: 'production',
          PHOTO_S3_BUCKET: data.photoBucket.bucketName,
          PHOTO_STORAGE_PROVIDER: 's3',
          RUNTIME_SECRET_ARN: data.runtimeSecret.secretArn,
        },
        executionRoleArn: executionRole.roleArn,
        maxConcurrencyPerEnvironment: 8,
        telemetryConfig: {
          loggingConfig: {
            applicationLogLevel: config.production ? 'INFO' : 'DEBUG',
            logGroup: logGroup.logGroupName,
            systemLogLevel: 'INFO',
          },
        },
        timeoutSeconds: 60,
      },
    });
    Validations.of(revision).acknowledge(
      {
        id: 'CloudFormation-Validate::E9004',
        reason: 'LatestVersionArn is documented for NetworkConnector and supported by the current aws-cdk-lib, ahead of the bundled schema.',
      },
      {
        id: 'CloudFormation-Validate::F3006',
        reason: 'AWS::Lambda::WebFunctionRevision is a newly released CloudFormation resource not yet present in the bundled validation schema.',
      },
    );
    revision.addResourceDependency(connector);
    revision.addResourceDependency(webFunction);
    revision.node.addDependency(migration);

    const endpoint = new lambda.CfnWebFunctionEndpoint(this, 'ApiEndpoint', {
      authType: config.authMode === 'development' ? 'IamAuth' : 'ApplicationManaged',
      description: `TripUS ${config.stage} mobile API`,
      endpointName: 'api',
      endpointType: 'HomeRegion',
      functionName: webFunction.functionName,
      revisionWeights: [{ revisionId: revision.attrRevisionId, weight: 100 }],
      scalingConfig: { maxEnvironments: config.maxApiEnvironments },
      throttleConfig: { rateLimit: config.maxApiRequestsPerSecond },
    });
    Validations.of(endpoint).acknowledge({
      id: 'CloudFormation-Validate::F3006',
      reason: 'AWS::Lambda::WebFunctionEndpoint is a newly released CloudFormation resource not yet present in the bundled validation schema.',
    });
    endpoint.addResourceDependency(revision);

    const alertTopic = new sns.Topic(this, 'AlertTopic', {
      displayName: `TripUS ${config.stage} deployment alerts`,
      enforceSSL: true,
      masterKey: kms.Alias.fromAliasName(this, 'SnsEncryptionKey', 'alias/aws/sns'),
      topicName: `tripus-${config.stage}-alerts`,
    });
    const alertAction = new cloudwatchActions.SnsAction(alertTopic);
    const requestMetricDimensions = { FunctionName: functionName, EndpointName: 'api' };
    const apiServerErrorAlarm = new cloudwatch.Alarm(this, 'ApiServerErrorAlarm', {
      alarmDescription: `TripUS ${config.stage} API returned one or more 5xx responses in five minutes`,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 1,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Lambda/Web',
        metricName: 'HTTPResponseStatusClass5XX',
        dimensionsMap: requestMetricDimensions,
        period: Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    apiServerErrorAlarm.addAlarmAction(alertAction);
    const apiThrottleAlarm = new cloudwatch.Alarm(this, 'ApiThrottleAlarm', {
      alarmDescription: `TripUS ${config.stage} API endpoint throttled one or more requests`,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 1,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Lambda/Web/Usage',
        metricName: 'EndpointRequestThrottles',
        dimensionsMap: { ...requestMetricDimensions, ExecutionRegion: this.region },
        period: Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    apiThrottleAlarm.addAlarmAction(alertAction);
    const migrationErrorAlarm = new cloudwatch.Alarm(this, 'MigrationErrorAlarm', {
      alarmDescription: `TripUS ${config.stage} database migration Lambda failed`,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 1,
      metric: migrationFunction.metricErrors({ period: Duration.minutes(5), statistic: 'Sum' }),
      threshold: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    migrationErrorAlarm.addAlarmAction(alertAction);

    const dashboard = new cloudwatch.Dashboard(this, 'OperationsDashboard', {
      dashboardName: `tripus-${config.stage}-operations`,
    });
    dashboard.addWidgets(new cloudwatch.AlarmStatusWidget({
      alarms: [apiServerErrorAlarm, apiThrottleAlarm, migrationErrorAlarm],
      height: 3,
      title: 'TripUS API alarms',
      width: 24,
    }));
    dashboard.addWidgets(
      new cloudwatch.LogQueryWidget({
        height: 6,
        logGroupNames: [logGroup.logGroupName],
        queryLines: [
          'fields @timestamp, level, method, path, statusCode, durationMs, requestId, message',
          'filter level = "error" or statusCode >= 500',
          'sort @timestamp desc',
          'limit 50',
        ],
        title: 'Recent API errors',
        view: cloudwatch.LogQueryVisualizationType.TABLE,
        width: 16,
      }),
      new cloudwatch.LogQueryWidget({
        height: 6,
        logGroupNames: [migrationLogGroup.logGroupName],
        queryLines: [
          'fields @timestamp, @message',
          'filter @message like /ERROR|Error|failed/',
          'sort @timestamp desc',
          'limit 20',
        ],
        title: 'Migration errors',
        view: cloudwatch.LogQueryVisualizationType.TABLE,
        width: 8,
      }),
    );

    new CfnOutput(this, 'AlertTopicArn', { value: alertTopic.topicArn });
    new CfnOutput(this, 'ApiEndpointDomain', { value: endpoint.attrDomainName });
    new CfnOutput(this, 'OperationsDashboardName', { value: dashboard.dashboardName });
    new CfnOutput(this, 'PhotoBucketName', { value: data.photoBucket.bucketName });
  }
}
