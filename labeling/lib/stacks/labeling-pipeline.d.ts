import { CfnOutput, Stack, Stage, pipelines } from "aws-cdk-lib";
import { Construct } from "constructs";
import { AppConfig } from "../../bin/app";
export declare class LabelingPipelineStack extends Stack {
    constructor(scope: Construct, id: string, props: AppConfig);
    getCodeSource(props: AppConfig): pipelines.CodePipelineSource;
}
export declare class DeployLabelingPipelineStage extends Stage {
    readonly piplineName: CfnOutput;
    constructor(scope: Construct, id: string, props: AppConfig);
}
