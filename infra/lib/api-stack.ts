import { CfnOutput, CustomResource, Duration, Fn, Stack, Validations, type StackProps } from 'aws-cdk-lib';
import * as customResources from 'aws-cdk-lib/custom-resources';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3deployment from 'aws-cdk-lib/aws-s3-deployment';
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
    const logGroup = new logs.LogGroup(this, 'ApiLogs', {
      logGroupName: `/aws/lambda/web/${functionName}`,
      retention: config.production ? logs.RetentionDays.THREE_MONTHS : logs.RetentionDays.ONE_MONTH,
    });

    const executionRole = new iam.Role(this, 'ApiExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'TripUS Lambda Web Function runtime permissions',
    });
    logGroup.grantWrite(executionRole);
    data.databaseSecret.grantRead(executionRole);
    data.runtimeSecret.grantRead(executionRole);
    data.photoBucket.grantReadWrite(executionRole);
    data.codeBucket.grantRead(executionRole);
    NagSuppressions.addResourceSuppressions(executionRole, [{
      id: 'AwsSolutions-IAM5',
      reason: 'The API serves dynamic per-user photo object keys and reads versioned deployment objects; object-level S3 ARNs necessarily contain a key wildcard.',
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
    Validations.of(connector).acknowledge({
      id: 'CloudFormation-Validate::W3030',
      reason: 'WebFunction is supported by the current Lambda NetworkConnector API but is not yet present in the bundled validation schema.',
    });

    const artifact = new s3deployment.BucketDeployment(this, 'ApiArtifact', {
      destinationBucket: data.codeBucket,
      destinationKeyPrefix: 'artifacts/api',
      extract: false,
      prune: false,
      sources: [s3deployment.Source.asset(props.apiArtifactPath)],
    });
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

    const migrationFunction = new lambda.Function(this, 'MigrationFunction', {
      architecture: lambda.Architecture.ARM_64,
      code: lambda.Code.fromBucket(
        data.codeBucket,
        Fn.select(0, artifact.objectKeys),
        Fn.select(0, artifact.objectVersionIds),
      ),
      description: `TripUS ${config.stage} TypeORM deployment migrations`,
      environment: {
        DATABASE_NAME: 'tripus',
        DATABASE_PROXY_HOST: data.databaseProxy.endpoint,
        DATABASE_SECRET_ARN: data.databaseSecret.secretArn,
        NODE_ENV: 'production',
      },
      handler: 'dist/database/migration-handler.handler',
      memorySize: 512,
      runtime: lambda.Runtime.NODEJS_24_X,
      securityGroups: [data.apiSecurityGroup],
      timeout: Duration.minutes(5),
      vpc: data.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });
    migrationFunction.node.addDependency(artifact);
    data.databaseSecret.grantRead(migrationFunction);
    NagSuppressions.addResourceSuppressions(migrationFunction, [{
      id: 'AwsSolutions-IAM4',
      reason: 'CDK attaches the AWS-managed Lambda basic execution and VPC access policies required by this deployment-only migration function.',
    }], true);

    const migrationProvider = new customResources.Provider(this, 'MigrationProvider', {
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
      properties: { artifactVersion: Fn.select(0, artifact.objectVersionIds) },
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
            key: Fn.select(0, artifact.objectKeys),
            versionId: Fn.select(0, artifact.objectVersionIds),
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
          AWS_LAMBDA_NODEJS_ENTRYPOINT: 'dist/main.js',
          DATABASE_NAME: 'tripus',
          DATABASE_PROXY_HOST: data.databaseProxy.endpoint,
          DATABASE_SECRET_ARN: data.databaseSecret.secretArn,
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
      authType: 'ApplicationManaged',
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

    new CfnOutput(this, 'ApiEndpointDomain', { value: endpoint.attrDomainName });
    new CfnOutput(this, 'PhotoBucketName', { value: data.photoBucket.bucketName });
  }
}
