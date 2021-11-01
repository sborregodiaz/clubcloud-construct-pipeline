import * as codeartifact from '@aws-cdk/aws-codeartifact';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codecommit from '@aws-cdk/aws-codecommit';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as actions from '@aws-cdk/aws-codepipeline-actions';
import * as ecr from '@aws-cdk/aws-ecr';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';

export class PipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // CodeArtifact resources
    const codeArtifactDomain = new codeartifact.CfnDomain(this, 'clubcloud-domain', {
      domainName: 'clubcloud-domain',
      permissionsPolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: [
              'codeartifact:DescribePackageVersion',
              'codeartifact:DescribeRepository',
              'codeartifact:GetPackageVersionReadme',
              'codeartifact:GetRepositoryEndpoint',
              'codeartifact:ListPackageVersionAssets',
              'codeartifact:ListPackageVersionDependencies',
              'codeartifact:ListPackageVersions',
              'codeartifact:ListPackages',
              'codeartifact:ReadFromRepository',
              'codeartifact:GetAuthorizationToken',
            ],
            Effect: 'Allow',
            Resource: '*',
            Principal: '*',
            Condition: {
              StringEquals: {
                'aws:PrincipalOrgID': [
                  '<ORG_ID>',
                ],
              },
            },
          },
          {
            Action: [
              'codeartifact:AssociateExternalConnection',
              'codeartifact:CopyPackageVersions',
              'codeartifact:DeletePackageVersions',
              'codeartifact:DeleteRepository',
              'codeartifact:DeleteRepositoryPermissionsPolicy',
              'codeartifact:DescribePackageVersion',
              'codeartifact:DescribeRepository',
              'codeartifact:DisassociateExternalConnection',
              'codeartifact:DisposePackageVersions',
              'codeartifact:GetPackageVersionReadme',
              'codeartifact:GetRepositoryEndpoint',
              'codeartifact:ListPackageVersionAssets',
              'codeartifact:ListPackageVersionDependencies',
              'codeartifact:ListPackageVersions',
              'codeartifact:ListPackages',
              'codeartifact:PublishPackageVersion',
              'codeartifact:PutPackageMetadata',
              'codeartifact:PutRepositoryPermissionsPolicy',
              'codeartifact:ReadFromRepository',
              'codeartifact:UpdatePackageVersionsStatus',
              'codeartifact:UpdateRepository',
            ],
            Effect: 'Allow',
            Principal: {
              AWS: `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:root`,
            },
            Resource: '*',
          },
        ],
      },
    });

    const codeArtifactNPMRepository = new codeartifact.CfnRepository(this, 'clubcloud-codeartifact-npm-repository', {
      domainName: codeArtifactDomain.attrName,
      repositoryName: 'clubcloud-npm-platform-constructs',
      externalConnections: [
        'public:npmjs',
      ],
    });

    const codeArtifactPyPiRepository = new codeartifact.CfnRepository(this, 'clubcloud-codeartifact-pypi-repository', {
      domainName: codeArtifactDomain.attrName,
      repositoryName: 'clubcloud-pypi-platform-constructs',
      externalConnections: [
        'public:pypi',
      ],
    });

    // CodeCommit resources
    const codeCommitRepository = new codecommit.Repository(this, 'clubcloud-codecommit-secure-bucket-construct-repository', {
      repositoryName: 'clubcloud-secure-bucket-construct',
    });

    // CodePipeline resources
    const pipelineRole = new iam.Role(this, 'clubcloud-codepipeline-role', {
      roleName: 'clubcloud-secure-bucket-construct-pipeline',
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('codepipeline.amazonaws.com'),
        new iam.ServicePrincipal('codebuild.amazonaws.com'),
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'), // Do NOT use this out in the real world
      ],
    });

    const codeCommitOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();
    const buildImage = codebuild.LinuxBuildImage.fromEcrRepository(ecr.Repository.fromRepositoryName(this, 'jsii', 'jsii/superchain'), 'node14');

    const buildAction = new codebuild.PipelineProject(this, 'clubcloud-secure-bucket-construct-build', {
      projectName: 'clubcloud-secure-bucket-construct-build',
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        artifacts: {
          files: ['**/*'],
        },
        phases: {
          pre_build: {
            commands: [
              'npx projen --version',
            ],
          },
          build: {
            commands: [
              'yarn install --check-files --frozen-lockfile',
              'npx projen release',
            ],
          },
        },
      }),
      environment: {
        buildImage: buildImage,
        privileged: true,
      },
      environmentVariables: {
        ORG_ID: {
          value: '<ORG_ID>',
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
        },
      },
      role: pipelineRole,
    });

    const publishNPMAction = new codebuild.PipelineProject(this, 'clubcloud-secure-bucket-construct-publish-npm', {
      projectName: 'clubcloud-secure-bucket-construct-publish-npm',
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: [
              `export CODEARTIFACT_AUTH_TOKEN=\`aws codeartifact get-authorization-token --domain ${codeArtifactDomain.attrName} --domain-owner ${cdk.Aws.ACCOUNT_ID} --query authorizationToken --output text\``,
              `echo "registry=https://${codeArtifactDomain.attrName}-${cdk.Aws.ACCOUNT_ID}.d.codeartifact.${cdk.Aws.REGION}.amazonaws.com/npm/${codeArtifactNPMRepository.attrName}/" >> .npmrc`,
              `echo "//${codeArtifactDomain.attrName}-${cdk.Aws.ACCOUNT_ID}.d.codeartifact.${cdk.Aws.REGION}.amazonaws.com/npm/${codeArtifactNPMRepository.attrName}/:always-auth=true" >> .npmrc`,
              `echo "//${codeArtifactDomain.attrName}-${cdk.Aws.ACCOUNT_ID}.d.codeartifact.${cdk.Aws.REGION}.amazonaws.com/npm/${codeArtifactNPMRepository.attrName}/:_authToken=\${CODEARTIFACT_AUTH_TOKEN}" >> .npmrc`,
              `export NPM_TOKEN=\`aws codeartifact get-authorization-token --domain ${codeArtifactDomain.attrName} --domain-owner ${codeArtifactDomain.attrOwner} --query authorizationToken --output text\``,
              'npx -p jsii-release jsii-release-npm',
            ],
          },
        },
      }),
      environment: {
        buildImage: buildImage,
        privileged: true,
      },
      role: pipelineRole,
    });

    const publishPyPIAction = new codebuild.PipelineProject(this, 'clubcloud-secure-bucket-construct-publish-pypi', {
      projectName: 'clubcloud-secure-bucket-construct-publish-pypi',
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              `aws codeartifact login --tool pip --repository ${codeArtifactPyPiRepository.attrName} --domain ${codeArtifactDomain.attrName} --domain-owner ${codeArtifactDomain.attrOwner}`,
            ],
          },
          build: {
            commands: [
              'export TWINE_USERNAME=aws',
              `export TWINE_PASSWORD=\`aws codeartifact get-authorization-token --domain ${codeArtifactDomain.attrName} --domain-owner ${codeArtifactDomain.attrOwner} --query authorizationToken --output text\``,
              `export TWINE_REPOSITORY_URL=\`aws codeartifact get-repository-endpoint --domain ${codeArtifactDomain.attrName} --domain-owner ${codeArtifactDomain.attrOwner} --repository ${codeArtifactPyPiRepository.attrName} --format pypi --query repositoryEndpoint --output text\``,
              'npx -p jsii-release@latest jsii-release-pypi',
            ],
          },
        },
      }),
      environment: {
        buildImage: buildImage, privileged: true,
      },
      role: pipelineRole,
    });

    const pipeline = new codepipeline.Pipeline(this, 'clubcloud-secure-bucket-construct-pipeline', {
      pipelineName: 'clubcloud-secure-bucket-construct-pipeline',
      role: pipelineRole,
      restartExecutionOnUpdate: true,
      stages: [
        {
          stageName: 'codecommitSource',
          actions: [
            new actions.CodeCommitSourceAction({
              actionName: 'codecommitSource',
              repository: codeCommitRepository,
              output: codeCommitOutput,
              branch: 'master',
              role: pipelineRole,

            }),
          ],
        },
        {
          stageName: 'releasebuild',
          actions: [
            new actions.CodeBuildAction({
              actionName: 'releasebuild',
              project: buildAction,
              input: codeCommitOutput,
              outputs: [buildOutput],
              role: pipelineRole,
            }),
          ],
        },
        {
          stageName: 'publishNPM',
          actions: [
            new actions.CodeBuildAction({
              actionName: 'publishNPM',
              project: publishNPMAction,
              input: buildOutput,
              role: pipelineRole,
            }),
          ],
        },
        {
          stageName: 'publishPyPI',
          actions: [
            new actions.CodeBuildAction({
              actionName: 'publishPyPI',
              project: publishPyPIAction,
              input: buildOutput,
              role: pipelineRole,
            }),
          ],
        },
      ],
    });

    // TODO: Check if this can be done without escape hatch
    const cfnPipeline = pipeline.node.defaultChild as codepipeline.CfnPipeline;
    cfnPipeline.addPropertyOverride('Stages.0.Actions.0.Configuration.OutputArtifactFormat', 'CODEBUILD_CLONE_REF');
  }
}