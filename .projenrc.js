const { AwsCdkTypeScriptApp } = require('projen');

const project = new AwsCdkTypeScriptApp({
  author: 'Sidney Borrego y Diaz',
  authorAddress: 'sidney@oblcc.com',
  cdkVersion: '1.127.0',
  projenVersion: '0.29.17',
  name: 'clubcloud-construct-pipeline',
  repositoryUrl: 'https://github.com/sborregodiaz/clubcloud-construct-pipeline',
  defaultReleaseBranch: 'main',
  cdkDependencies: [
    '@aws-cdk/core',
    '@aws-cdk/aws-codeartifact',
    '@aws-cdk/aws-codebuild',
    '@aws-cdk/aws-codecommit',
    '@aws-cdk/aws-codepipeline',
    '@aws-cdk/aws-codepipeline-actions',
    '@aws-cdk/aws-iam',
    '@aws-cdk/aws-ecr',
  ],
  devDeps: [
    'ts-node',
    '@jest/globals',
  ],
  // GitHub configuration
  buildWorkflow: false,
  dependabot: false,
  mergify: false,
  pullRequestTemplate: false,
  releaseWorkflow: false,
  tsconfig: {
    compilerOptions: {
      lib: ['es2019', 'dom'], // 251021: Many Projen upgrades broke over night due to TS2304: Cannot find name 'AbortSignal'. Turns out it's a DefinitelyTyped bug.  They're working on it. https://github.com/DefinitelyTyped/DefinitelyTyped/pull/56713/files
    },
  },
});

project.synth();