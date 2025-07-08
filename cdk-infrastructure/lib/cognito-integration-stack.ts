import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config/environments';
import * as path from 'path';

export interface CognitoIntegrationStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  userPoolId: string;
  userPoolClientId: string;
  sbtEventBusArn: string;
}

export class CognitoIntegrationStack extends cdk.Stack {
  public readonly cognitoIntegrationFunction: lambda.Function;
  public readonly cognitoApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: CognitoIntegrationStackProps) {
    super(scope, id, props);

    const { config } = props;

    // IAM Role for Cognito Integration
    const cognitoIntegrationRole = new iam.Role(this, 'CognitoIntegrationRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
      inlinePolicies: {
        CognitoIntegration: new iam.PolicyDocument({
          statements: [
            // Cognito Admin permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cognito-idp:AdminCreateUser',
                'cognito-idp:AdminDeleteUser',
                'cognito-idp:AdminUpdateUserAttributes',
                'cognito-idp:AdminGetUser',
                'cognito-idp:AdminSetUserPassword',
                'cognito-idp:AdminAddUserToGroup',
                'cognito-idp:AdminRemoveUserFromGroup',
                'cognito-idp:AdminListGroupsForUser',
                'cognito-idp:AdminDisableUser',
                'cognito-idp:AdminEnableUser',
                'cognito-idp:ListUsers',
                'cognito-idp:ListUsersInGroup',
                'cognito-idp:ListGroups',
              ],
              resources: [
                `arn:aws:cognito-idp:${this.region}:${this.account}:userpool/${props.userPoolId}`,
              ],
            }),
            // DynamoDB access for tenant and user metadata
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
              ],
              resources: [
                `arn:aws:dynamodb:${this.region}:${this.account}:table/SBT-Tenants-${config.environment}`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/CloudBPA-UserMetadata-${config.environment}`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/CloudBPA-UserAnalytics-${config.environment}`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/SBT-Tenants-${config.environment}/index/*`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/CloudBPA-UserMetadata-${config.environment}/index/*`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/CloudBPA-UserAnalytics-${config.environment}/index/*`,
              ],
            }),
            // EventBridge access for user events
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['events:PutEvents'],
              resources: [
                props.sbtEventBusArn,
                `arn:aws:events:${this.region}:${this.account}:event-bus/default`,
              ],
            }),
          ],
        }),
      },
    });

    // Lambda function for Cognito integration
    this.cognitoIntegrationFunction = new nodejs.NodejsFunction(this, 'CognitoIntegrationFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '../src/functions/cognito-integration.ts'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      role: cognitoIntegrationRole,
      environment: {
        NODE_ENV: 'production',
        ENVIRONMENT: config.environment,
        USER_POOL_ID: props.userPoolId,
        USER_POOL_CLIENT_ID: props.userPoolClientId,
        SBT_TENANTS_TABLE: `SBT-Tenants-${config.environment}`,
        EVENT_BUS_NAME: `CloudBPA-SBT-Events-${config.environment}`,
        LOG_LEVEL: config.lambdaConfig.logLevel,
      },
      tracing: lambda.Tracing.ACTIVE,
      functionName: `CloudBPA-CognitoIntegration-${config.environment}`,
    });

    // API Gateway for Cognito integration
    this.cognitoApi = new apigateway.RestApi(this, 'CognitoAPI', {
      restApiName: `CloudBPA-Cognito-API-${config.environment}`,
      description: 'API for Cognito user management and authentication',
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
      defaultCorsPreflightOptions: {
        allowOrigins: config.cognitoConfig.allowedOrigins,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Requested-With',
        ],
        maxAge: cdk.Duration.seconds(600),
      },
    });

    // Cognito Authorizer
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [
        {
          userPoolId: props.userPoolId,
          userPoolClientId: props.userPoolClientId,
        } as any, // Type assertion to work around type issues
      ],
      authorizerName: 'CognitoAuthorizer',
      identitySource: 'method.request.header.Authorization',
      resultsCacheTtl: cdk.Duration.minutes(5),
    });

    // Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(
      this.cognitoIntegrationFunction,
      {
        requestTemplates: {
          'application/json': JSON.stringify({
            httpMethod: '$context.httpMethod',
            resourcePath: '$context.resourcePath',
            pathParameters: '$input.params().path',
            queryStringParameters: '$input.params().querystring',
            body: '$input.json("$")',
            requestContext: {
              accountId: '$context.accountId',
              requestId: '$context.requestId',
              identity: {
                cognitoIdentityId: '$context.identity.cognitoIdentityId',
                cognitoAuthenticationType: '$context.identity.cognitoAuthenticationType',
                claims: '$context.authorizer.claims',
              },
            },
          }),
        },
        proxy: false,
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
          {
            statusCode: '400',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
          {
            statusCode: '403',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
          {
            statusCode: '404',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
          {
            statusCode: '500',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
        ],
      }
    );

    // API Resources and Methods
    // /users
    const usersResource = this.cognitoApi.root.addResource('users');
    usersResource.addMethod('GET', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });
    usersResource.addMethod('POST', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '201',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // /users/{userId}
    const userResource = usersResource.addResource('{userId}');
    userResource.addMethod('GET', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });
    userResource.addMethod('PUT', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });
    userResource.addMethod('DELETE', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // /users/{userId}/reset-password
    const resetPasswordResource = userResource.addResource('reset-password');
    resetPasswordResource.addMethod('POST', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // /users/{userId}/change-role
    const changeRoleResource = userResource.addResource('change-role');
    changeRoleResource.addMethod('POST', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // /groups
    const groupsResource = this.cognitoApi.root.addResource('groups');
    groupsResource.addMethod('GET', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // /groups/{groupName}/users
    const groupResource = groupsResource.addResource('{groupName}');
    const groupUsersResource = groupResource.addResource('users');
    groupUsersResource.addMethod('GET', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // SSM Parameters for configuration
    new ssm.StringParameter(this, 'CognitoApiUrlParameter', {
      parameterName: `/cloudbpa/${config.environment}/cognito/api-url`,
      stringValue: this.cognitoApi.url,
      description: 'Cognito integration API URL',
    });

    new ssm.StringParameter(this, 'CognitoFunctionArnParameter', {
      parameterName: `/cloudbpa/${config.environment}/cognito/function-arn`,
      stringValue: this.cognitoIntegrationFunction.functionArn,
      description: 'Cognito integration Lambda function ARN',
    });

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'CognitoApiUrl', {
      value: this.cognitoApi.url,
      description: 'Cognito Integration API URL',
      exportName: `${id}-CognitoApiUrl`,
    });

    new cdk.CfnOutput(this, 'CognitoFunctionArn', {
      value: this.cognitoIntegrationFunction.functionArn,
      description: 'Cognito Integration Lambda Function ARN',
      exportName: `${id}-CognitoFunctionArn`,
    });

    // CloudWatch Dashboard for monitoring user management
    const dashboard = new cdk.aws_cloudwatch.Dashboard(this, 'CognitoDashboard', {
      dashboardName: `CloudBPA-Cognito-${config.environment}`,
    });

    // Add widgets for monitoring
    dashboard.addWidgets(
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'User Management Operations',
        left: [this.cognitoIntegrationFunction.metricInvocations()],
        right: [this.cognitoIntegrationFunction.metricErrors()],
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'API Gateway Metrics',
        left: [this.cognitoApi.metricCount()],
        right: [this.cognitoApi.metricLatency()],
      })
    );

    // Tags
    cdk.Tags.of(this).add('Project', 'CloudBestPracticeAnalyzer');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('Service', 'CognitoIntegration');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}