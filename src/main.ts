import { App } from '@aws-cdk/core';
import { PipelineStack } from './lib/pipeline-stack';

const environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new PipelineStack(app, 'clubcloud-construct-pipeline', { env: environment, tags: { Owner: 'ClubCloud' } });


app.synth();