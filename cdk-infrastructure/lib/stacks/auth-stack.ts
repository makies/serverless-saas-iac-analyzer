import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { USER_ROLES } from '../config/constants';

export interface AuthStackProps {
  config: EnvironmentConfig;
  description?: string;
}

export class AuthStack extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;
  public readonly authenticatedRole: iam.Role;
  public readonly unauthenticatedRole: iam.Role;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id);

    const { config } = props;

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${config.cognitoConfig.userPoolName}-${config.environment}`,
      signInAliases: {
        email: true,
        username: true,
      },
      signInCaseSensitive: false,
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        tenantId: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 50,
          mutable: true,
        }),
        role: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 50,
          mutable: true,
        }),
        projectIds: new cognito.StringAttribute({
          minLen: 0,
          maxLen: 2000,
          mutable: true,
        }),
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      selfSignUpEnabled: false, // 招待制
      userInvitation: {
        emailBody: `こんにちは,

${config.cognitoConfig.userPoolName}にご招待いたします。

ユーザー名: {username}
一時パスワード: {####}

初回ログイン後にパスワードを変更してください。

アプリケーション URL: ${config.cognitoConfig.allowedOrigins[0]}

ご質問がございましたら、システム管理者までお問い合わせください。`,
        emailSubject: `${config.cognitoConfig.userPoolName}への招待`,
        smsMessage: `${config.cognitoConfig.userPoolName}への招待 - ユーザー名: {username}, 一時パスワード: {####}`,
      },
      autoVerify: {
        email: true,
      },
      userVerification: {
        emailSubject: `${config.cognitoConfig.userPoolName} - メールアドレスの確認`,
        emailBody: `
メールアドレスの確認コード: {####}

このコードを入力してメールアドレスを確認してください。
        `,
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      deviceTracking: {
        challengeRequiredOnNewDevice: true,
        deviceOnlyRememberedOnUserPrompt: true,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      deletionProtection: config.environment === 'prod',
      removalPolicy:
        config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // User Pool Groups (ロールベース)
    Object.values(USER_ROLES).forEach((role) => {
      new cognito.CfnUserPoolGroup(this, `${role}Group`, {
        userPoolId: this.userPool.userPoolId,
        groupName: role,
        description: `${role} user group`,
        precedence: this.getRolePrecedence(role),
      });
    });

    // Lambda functions for Cognito triggers
    const cognitoTriggersFunction = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'CognitoTriggersFunction', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
      handler: 'preAuthentication',
      entry: require('path').join(__dirname, '../src/functions/cognito-triggers.ts'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        NODE_ENV: 'production',
        ENVIRONMENT: config.environment,
        SBT_TENANTS_TABLE: `SBT-Tenants-${config.environment}`,
        USER_ANALYTICS_TABLE: `CloudBPA-UserAnalytics-${config.environment}`,
        EVENT_BUS_NAME: `CloudBPA-SBT-Events-${config.environment}`,
        LOG_LEVEL: config.lambdaConfig.logLevel,
      },
      tracing: cdk.aws_lambda.Tracing.ACTIVE,
      functionName: `CloudBPA-CognitoTriggers-${config.environment}`,
    });

    // Grant permissions for Cognito triggers
    cognitoTriggersFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:Query',
        ],
        resources: [
          `arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/SBT-Tenants-${config.environment}`,
          `arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/CloudBPA-UserAnalytics-${config.environment}`,
          `arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/CloudBPA-UserMetadata-${config.environment}`,
        ],
      })
    );

    cognitoTriggersFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['events:PutEvents'],
        resources: [`arn:aws:events:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:event-bus/CloudBPA-SBT-Events-${config.environment}`],
      })
    );

    // User Pool with Lambda triggers
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${config.cognitoConfig.userPoolName}-${config.environment}`,
      signInAliases: {
        email: true,
        username: true,
      },
      signInCaseSensitive: false,
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        tenantId: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 50,
          mutable: true,
        }),
        role: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 50,
          mutable: true,
        }),
        projectIds: new cognito.StringAttribute({
          minLen: 0,
          maxLen: 2000,
          mutable: true,
        }),
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      selfSignUpEnabled: false, // 招待制
      userInvitation: {
        emailBody: `こんにちは,

${config.cognitoConfig.userPoolName}にご招待いたします。

ユーザー名: {username}
一時パスワード: {####}

初回ログイン後にパスワードを変更してください。

アプリケーション URL: ${config.cognitoConfig.allowedOrigins[0]}

ご質問がございましたら、システム管理者までお問い合わせください。`,
        emailSubject: `${config.cognitoConfig.userPoolName}への招待`,
        smsMessage: `${config.cognitoConfig.userPoolName}への招待 - ユーザー名: {username}, 一時パスワード: {####}`,
      },
      autoVerify: {
        email: true,
      },
      userVerification: {
        emailSubject: `${config.cognitoConfig.userPoolName} - メールアドレスの確認`,
        emailBody: `
メールアドレスの確認コード: {####}

このコードを入力してメールアドレスを確認してください。
        `,
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      deviceTracking: {
        challengeRequiredOnNewDevice: true,
        deviceOnlyRememberedOnUserPrompt: true,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      lambdaTriggers: {
        preAuthentication: cognitoTriggersFunction,
        postAuthentication: cognitoTriggersFunction,
        preTokenGeneration: cognitoTriggersFunction,
        postConfirmation: cognitoTriggersFunction,
        defineAuthChallenge: cognitoTriggersFunction,
        createAuthChallenge: cognitoTriggersFunction,
        verifyAuthChallengeResponse: cognitoTriggersFunction,
      },
      deletionProtection: config.environment === 'prod',
      removalPolicy:
        config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `${config.cognitoConfig.userPoolName}-client-${config.environment}`,
      authFlows: {
        userSrp: true,
        adminUserPassword: true,
        custom: true, // Enable custom auth for MFA
        userPassword: false,
      },
      generateSecret: false, // SPAなのでシークレット不要
      preventUserExistenceErrors: true,
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      enableTokenRevocation: true,
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: config.cognitoConfig.allowedOrigins.map(
          (origin) => `${origin}/auth/callback`
        ),
        logoutUrls: config.cognitoConfig.allowedOrigins.map((origin) => `${origin}/auth/logout`),
      },
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          email: true,
          givenName: true,
          familyName: true,
        })
        .withCustomAttributes('tenantId', 'role', 'projectIds'),
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          email: true,
          givenName: true,
          familyName: true,
        })
        .withCustomAttributes('tenantId', 'role', 'projectIds'),
    });

    // User Pool Domain
    const domain = this.userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: `cloud-bpa-${config.environment}-${cdk.Aws.ACCOUNT_ID}`,
      },
    });

    // Identity Pool
    this.identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: `${config.cognitoConfig.userPoolName}Identity-${config.environment}`,
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
          serverSideTokenCheck: true,
        },
      ],
    });

    // IAM Roles for Identity Pool
    this.authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
      roleName: `CloudBPA-AuthenticatedRole-${config.environment}`,
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AWSAppSyncInvokeFullAccess')],
      inlinePolicies: {
        S3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
              resources: [
                // テナント固有のプレフィックスのみアクセス可能
                `arn:aws:s3:::${config.s3Config.bucketName}-${config.environment}/tenants/\${cognito-identity.amazonaws.com:sub}/*`,
              ],
            }),
          ],
        }),
        CognitoAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['cognito-idp:GetUser', 'cognito-idp:UpdateUserAttributes'],
              resources: [this.userPool.userPoolArn],
            }),
          ],
        }),
      },
    });

    this.unauthenticatedRole = new iam.Role(this, 'UnauthenticatedRole', {
      roleName: `CloudBPA-UnauthenticatedRole-${config.environment}`,
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      inlinePolicies: {
        DenyAll: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.DENY,
              actions: ['*'],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // Identity Pool Role Attachment
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: this.authenticatedRole.roleArn,
        unauthenticated: this.unauthenticatedRole.roleArn,
      },
      roleMappings: {
        'cognito-idp': {
          type: 'Token',
          ambiguousRoleResolution: 'AuthenticatedRole',
          identityProvider: `cognito-idp.${cdk.Aws.REGION}.amazonaws.com/${this.userPool.userPoolId}:${this.userPoolClient.userPoolClientId}`,
        },
      },
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'UserPoolDomainUrl', {
      value: domain.domainName,
      description: 'Cognito User Pool Domain URL',
    });
  }

  private getRolePrecedence(role: string): number {
    const precedenceMap: Record<string, number> = {
      [USER_ROLES.SYSTEM_ADMIN]: 0,
      [USER_ROLES.CLIENT_ADMIN]: 1,
      [USER_ROLES.PROJECT_MANAGER]: 2,
      [USER_ROLES.ANALYST]: 3,
      [USER_ROLES.VIEWER]: 4,
      [USER_ROLES.CLIENT_ENGINEER]: 5,
    };
    return precedenceMap[role] || 99;
  }
}
