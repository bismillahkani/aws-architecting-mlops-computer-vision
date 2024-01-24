import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AppConfig } from '../../bin/app';
export declare class InferenceCdkPipeline extends cdk.Stack {
    constructor(scope: Construct, id: string, props: AppConfig);
    getCodeSource(props: AppConfig): cdk.pipelines.CodePipelineSource;
}
