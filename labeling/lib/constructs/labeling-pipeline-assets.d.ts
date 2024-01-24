import * as lambda_python from '@aws-cdk/aws-lambda-python-alpha';
import { aws_iam as iam, aws_lambda as lambda, CfnOutput } from 'aws-cdk-lib';
import { DockerImageFunction } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { StateMachinePipelineProps } from '../stacks/statemachine-pipeline';
/**
 * Construct to create all supporting artifacts required for StepFunction exexution
 */
export declare class PipelineAssets extends Construct {
    readonly pipeline_role: CfnOutput;
    readonly labeling_job_lambda: lambda_python.PythonFunction;
    readonly verification_job_lambda: lambda_python.PythonFunction;
    readonly check_missing_labels_lambda: DockerImageFunction;
    readonly update_feature_store_lambda: lambda_python.PythonFunction;
    constructor(scope: Construct, id: string, props: StateMachinePipelineProps);
    createExecutionRole(props: StateMachinePipelineProps): iam.Role;
    updateFeatureStoreLambda(props: StateMachinePipelineProps, role: iam.Role): lambda.DockerImageFunction;
    createMissingLabelsLambda(props: StateMachinePipelineProps, role: iam.Role): lambda.DockerImageFunction;
    createRunLabelingJobLambda(props: StateMachinePipelineProps, role: iam.Role): lambda_python.PythonFunction;
    createRunVerificationJobLambda(props: StateMachinePipelineProps, role: iam.Role): lambda_python.PythonFunction;
}
