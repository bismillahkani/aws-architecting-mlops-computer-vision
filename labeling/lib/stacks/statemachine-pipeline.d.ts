import { aws_codepipeline_actions as codepipeline_actions, CfnOutput, Stack } from "aws-cdk-lib";
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from "constructs";
import { PipelineAssets } from "../constructs/labeling-pipeline-assets";
import { AppConfig } from "../../bin/app";
/**
 * Stack to create Pipeline in Codepipeline which is responsible to execute Stepfunctions Statemachine
 */
export interface StateMachinePipelineProps extends AppConfig {
    readonly assetsBucket: string;
}
export declare class ExecuteStateMachinePipeline extends Stack {
    readonly labelingPipelineName: CfnOutput;
    constructor(scope: Construct, id: string, props: StateMachinePipelineProps);
    getCodeSource(props: AppConfig): codepipeline_actions.CodeStarConnectionsSourceAction | codepipeline_actions.CodeCommitSourceAction;
    /**
     * Defines the statemachine which executes the labeling workflow
     * @param pipelineAssets
     * @returns StateMachineDefintion
     */
    getStateMachineDefinition(pipelineAssets: PipelineAssets): sfn.Chain;
    createLabelingJobWaiter(labelingJobName: string, fail: sfn.Fail, next: sfn.IChainable): sfn.Chain;
}
