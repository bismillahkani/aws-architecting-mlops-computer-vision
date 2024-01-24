import { StackProps, aws_codebuild as codebuild } from 'aws-cdk-lib';
import { Construct } from 'constructs';
export declare class GgInferenceComponentBuildConstruct extends Construct {
    readonly ggInferenceComponentBuild: codebuild.PipelineProject;
    constructor(scope: Construct, id: string, props?: StackProps);
}
