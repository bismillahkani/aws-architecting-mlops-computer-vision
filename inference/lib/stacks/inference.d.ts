import { aws_codepipeline as codepipeline, CfnOutput, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AppConfig } from '../../bin/app';
export declare class Inference extends Stack {
    readonly edgeDeploymentPipeline: codepipeline.Pipeline;
    readonly pipelineName: CfnOutput;
    constructor(scope: Construct, id: string, props: AppConfig);
}
