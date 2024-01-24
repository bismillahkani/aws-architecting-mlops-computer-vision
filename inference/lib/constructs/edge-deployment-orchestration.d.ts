import { StepFunctionInvokeAction } from "aws-cdk-lib/aws-codepipeline-actions";
import { Construct } from 'constructs';
import { AppConfig } from '../../bin/app';
export interface EdgeDeploymentOrchestrationConstructProps extends AppConfig {
    iotThingName: string;
}
export declare class EdgeDeploymentOrchestrationConstruct extends Construct {
    static readonly MODEL_PACKAGE_GROUP_NAME = "TagQualityInspectionPackageGroup";
    readonly stepFunctionName: string;
    readonly stepFunctionArn: string;
    readonly stepFunctionAction: StepFunctionInvokeAction;
    constructor(scope: Construct, id: string, props: EdgeDeploymentOrchestrationConstructProps);
}
