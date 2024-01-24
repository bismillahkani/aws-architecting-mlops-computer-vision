import { aws_codebuild as codebuild, aws_codepipeline as codepipeline, aws_codepipeline_actions as codepipeline_actions, CfnOutput } from 'aws-cdk-lib';
import { StepFunctionInvokeAction } from "aws-cdk-lib/aws-codepipeline-actions";
import { Construct } from 'constructs';
import { AppConfig } from '../../bin/app';
export interface EdgeCiCdPipelineConstructProps extends AppConfig {
    iotThingName: string;
    ggInferenceComponentBuild: codebuild.PipelineProject;
    edgeDeploymentStepFunction: StepFunctionInvokeAction;
}
export declare class EdgeCiCdPipelineConstruct extends Construct {
    readonly pipelineName: CfnOutput;
    constructor(scope: Construct, id: string, props: EdgeCiCdPipelineConstructProps);
    getCodeSource(props: AppConfig, sourceOutput: codepipeline.Artifact): codepipeline_actions.CodeStarConnectionsSourceAction | codepipeline_actions.CodeCommitSourceAction;
}
