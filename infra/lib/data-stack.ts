import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { NagSuppressions } from 'cdk-nag';
import type { Construct } from 'constructs';

import type { StageConfig } from './stage-config.js';

export interface DataStackProps extends StackProps {
  readonly config: StageConfig;
}

export class DataStack extends Stack {
  public readonly applicationDatabaseSecret: secretsmanager.ISecret;
  public readonly apiSecurityGroup: ec2.SecurityGroup;
  public readonly codeBucket: s3.Bucket;
  public readonly databaseProxy: rds.DatabaseProxy;
  public readonly databaseSecret: secretsmanager.ISecret;
  public readonly photoBucket: s3.Bucket;
  public readonly runtimeSecret: secretsmanager.Secret;
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { config } = props;

    const accessLogBucket = new s3.Bucket(this, 'AccessLogBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [{ expiration: Duration.days(config.production ? 365 : 90) }],
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    NagSuppressions.addResourceSuppressions(accessLogBucket, [{
      id: 'AwsSolutions-S1',
      reason: 'This dedicated access-log destination cannot recursively deliver access logs to itself.',
    }]);

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      enableDnsHostnames: true,
      enableDnsSupport: true,
      maxAzs: 2,
      natGateways: config.aiPlannerProvider === 'openai' || config.authMode === 'jwt' || config.mapsProvider === 'google' ? 1 : 0,
      subnetConfiguration: [
        { cidrMask: 24, name: 'Public', subnetType: ec2.SubnetType.PUBLIC },
        { cidrMask: 24, name: 'Application', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { cidrMask: 24, name: 'Database', subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });
    this.vpc.addGatewayEndpoint('S3Endpoint', { service: ec2.GatewayVpcEndpointAwsService.S3 });
    this.vpc.addFlowLog('FlowLog', {
      destination: ec2.FlowLogDestination.toS3(accessLogBucket, 'vpc-flow-logs/'),
      trafficType: ec2.FlowLogTrafficType.REJECT,
    });
    const secretsManagerEndpoint = this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });
    NagSuppressions.addResourceSuppressions(secretsManagerEndpoint, [{
      id: 'CdkNagValidationFailure',
      reason: 'The endpoint security group source is the VPC CIDR exposed as a CloudFormation intrinsic, which EC23 cannot statically resolve.',
    }], true);

    this.apiSecurityGroup = new ec2.SecurityGroup(this, 'ApiSecurityGroup', {
      allowAllOutbound: true,
      description: 'Lambda Web Function VPC egress connector',
      vpc: this.vpc,
    });
    const databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      allowAllOutbound: false,
      description: 'Aurora PostgreSQL access from the API connector',
      vpc: this.vpc,
    });
    databaseSecurityGroup.addIngressRule(this.apiSecurityGroup, ec2.Port.tcp(5432), 'PostgreSQL from API');

    const database = new rds.DatabaseCluster(this, 'Database', {
      backup: { retention: Duration.days(config.production ? 14 : 7) },
      credentials: rds.Credentials.fromGeneratedSecret('tripus_admin'),
      defaultDatabaseName: 'tripus',
      deletionProtection: true,
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_11,
      }),
      monitoringInterval: Duration.seconds(60),
      iamAuthentication: true,
      removalPolicy: RemovalPolicy.SNAPSHOT,
      securityGroups: [databaseSecurityGroup],
      serverlessV2MaxCapacity: config.production ? 4 : 2,
      serverlessV2MinCapacity: config.production ? 1 : 0.5,
      storageEncrypted: true,
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      writer: rds.ClusterInstance.serverlessV2('Writer', { publiclyAccessible: false }),
    });
    if (!database.secret) throw new Error('Aurora credentials secret was not created');
    this.databaseSecret = database.secret;
    database.addRotationSingleUser({
      automaticallyAfter: Duration.days(30),
      endpoint: secretsManagerEndpoint,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });
    const applicationDatabaseSecret = new rds.DatabaseSecret(this, 'ApplicationDatabaseSecret', {
      dbname: 'tripus',
      masterSecret: this.databaseSecret,
      secretName: `tripus/${config.stage}/database/application`,
      username: 'tripus_app',
    });
    if (!config.applicationDatabaseRotation) {
      NagSuppressions.addResourceSuppressions(applicationDatabaseSecret, [{
        id: 'AwsSolutions-SMG4',
        reason: 'Rotation is deliberately enabled in a second deployment after migration provisions the tripus_app database role.',
      }]);
    }
    this.applicationDatabaseSecret = applicationDatabaseSecret.attach(database);
    if (config.applicationDatabaseRotation) {
      database.addRotationMultiUser('ApplicationDatabaseSecretRotation', {
        automaticallyAfter: Duration.days(30),
        endpoint: secretsManagerEndpoint,
        rotateImmediatelyOnUpdate: false,
        secret: this.applicationDatabaseSecret,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      });
    }
    const monitoringRole = database.node.tryFindChild('MonitoringRole');
    if (monitoringRole) {
      NagSuppressions.addResourceSuppressions(monitoringRole, [{
        id: 'AwsSolutions-IAM4',
        reason: 'RDS enhanced monitoring requires the AWS-managed AmazonRDSEnhancedMonitoringRole policy.',
      }], true);
    }

    this.databaseProxy = new rds.DatabaseProxy(this, 'DatabaseProxy', {
      dbProxyName: `tripus-${config.stage}`,
      debugLogging: !config.production,
      requireTLS: true,
      secrets: [this.databaseSecret, this.applicationDatabaseSecret],
      securityGroups: [databaseSecurityGroup],
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      proxyTarget: rds.ProxyTarget.fromCluster(database),
    });

    this.photoBucket = new s3.Bucket(this, 'PhotoBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [{ abortIncompleteMultipartUploadAfter: Duration.days(7) }],
      removalPolicy: RemovalPolicy.RETAIN,
      serverAccessLogsBucket: accessLogBucket,
      serverAccessLogsPrefix: 's3-access/photo/',
      versioned: true,
    });

    this.codeBucket = new s3.Bucket(this, 'CodeBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [{ noncurrentVersionExpiration: Duration.days(30) }],
      removalPolicy: RemovalPolicy.RETAIN,
      serverAccessLogsBucket: accessLogBucket,
      serverAccessLogsPrefix: 's3-access/code/',
      versioned: true,
    });
    this.codeBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:GetObjectVersion'],
      conditions: { StringEquals: { 'aws:SourceAccount': this.account } },
      principals: [new iam.ServicePrincipal('lambda.amazonaws.com')],
      resources: [this.codeBucket.arnForObjects('artifacts/api/*')],
    }));

    this.runtimeSecret = new secretsmanager.Secret(this, 'RuntimeSecret', {
      description: `TripUS ${config.stage} API runtime configuration`,
      generateSecretString: {
        excludePunctuation: true,
        generateStringKey: 'ACCESS_TOKEN_SECRET',
        includeSpace: false,
        passwordLength: 64,
        secretStringTemplate: JSON.stringify({
          AI_PLANNER_PROVIDER: config.aiPlannerProvider,
          AUTH_MODE: config.authMode,
          BILLING_PROVIDER: 'disabled',
          MAPS_PROVIDER: config.mapsProvider,
        }),
      },
    });
    NagSuppressions.addResourceSuppressions(this.runtimeSecret, [{
      id: 'AwsSolutions-SMG4',
      reason: 'This configuration secret contains API credentials from external providers; rotation is provider-managed and coordinated manually.',
    }]);

    new CfnOutput(this, 'RuntimeSecretArn', { value: this.runtimeSecret.secretArn });
    new CfnOutput(this, 'DatabaseProxyEndpoint', { value: this.databaseProxy.endpoint });
  }
}
