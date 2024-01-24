"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineAssets = void 0;
const lambda_python = require("@aws-cdk/aws-lambda-python-alpha");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_lambda_1 = require("aws-cdk-lib/aws-lambda");
const constructs_1 = require("constructs");
const path = require("path");
/**
 * Construct to create all supporting artifacts required for StepFunction exexution
 */
class PipelineAssets extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        // create execution role for stepfunction pipeline
        const pipeline_role = this.createExecutionRole(props);
        // create lambda which checks for missing labels
        this.check_missing_labels_lambda = this.createMissingLabelsLambda(props, pipeline_role);
        //create lambda function for SM Ground Truth verification job
        this.verification_job_lambda = this.createRunVerificationJobLambda(props, pipeline_role);
        //create lambda function for SM Ground Truth labeling job
        this.labeling_job_lambda = this.createRunLabelingJobLambda(props, pipeline_role);
        // create lambda which updates labels in feature store
        this.update_feature_store_lambda = this.updateFeatureStoreLambda(props, pipeline_role);
    }
    createExecutionRole(props) {
        const pipelineRole = new aws_cdk_lib_1.aws_iam.Role(this, 'StepFunctionsExecutionRole', {
            assumedBy: new aws_cdk_lib_1.aws_iam.CompositePrincipal(new aws_cdk_lib_1.aws_iam.ServicePrincipal('sagemaker.amazonaws.com'), new aws_cdk_lib_1.aws_iam.ServicePrincipal('lambda.amazonaws.com'))
        });
        pipelineRole.addToPolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            resources: ['*'],
            actions: ['sagemaker:DescribeLabelingJob', 'cloudwatch:DescribeLogStreams', 'cloudwatch:CreateLogGroup', 'cloudwatch:CreateLogStream', 'logs:PutLogEvents', 'states:StartExecution'],
        }));
        pipelineRole.addToPolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            resources: [`arn:aws:s3:::${props.assetsBucket}`, `arn:aws:s3:::${props.assetsBucket}/*`],
            actions: ['s3:*'],
        }));
        pipelineRole.addManagedPolicy(aws_cdk_lib_1.aws_iam.ManagedPolicy.fromManagedPolicyArn(this, 'S3ReadOnlyPolicy', 'arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess'));
        pipelineRole.addToPolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            resources: [`arn:aws:athena:${aws_cdk_lib_1.Stack.of(this).region}:${aws_cdk_lib_1.Stack.of(this).account}:workgroup/primary`],
            actions: ['athena:StartQueryExecution', 'athena:GetQueryExecution', 'athena:GetQueryResults', 'athena:StopQueryExecution', 'athena:GetWorkGroup']
        }));
        pipelineRole.addManagedPolicy(aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'));
        //pipelineRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'))
        pipelineRole.addManagedPolicy(aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));
        return pipelineRole;
    }
    updateFeatureStoreLambda(props, role) {
        return new aws_cdk_lib_1.aws_lambda.DockerImageFunction(this, 'UpdateFeatureStoreLambda', {
            code: aws_cdk_lib_1.aws_lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../lambda/update_feature_store')),
            architecture: aws_lambda_1.Architecture.X86_64,
            functionName: "UpdateLabelsInFeatureStoreFunction",
            memorySize: 1024,
            timeout: aws_cdk_lib_1.Duration.seconds(600),
            role: role,
            environment: {
                "ROLE": role.roleArn,
                "FEATURE_GROUP_NAME": props.featureGroupName,
                "FEATURE_NAME_S3URI": "source_ref",
                "FEATURE_STORE_S3URI": `s3://${props.assetsBucket}/feature-store/`,
                "QUERY_RESULTS_S3URI": `s3://${props.assetsBucket}/tmp/feature_store_query_results`,
            }
        });
    }
    createMissingLabelsLambda(props, role) {
        const missingLabelsLambda = new aws_cdk_lib_1.aws_lambda.DockerImageFunction(this, 'CheckMissingLabelsFunction', {
            code: aws_cdk_lib_1.aws_lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../lambda/check_missing_labels')),
            architecture: aws_lambda_1.Architecture.X86_64,
            functionName: "CheckMissingLabelsFunction",
            memorySize: 1024,
            role: role,
            timeout: aws_cdk_lib_1.Duration.seconds(300),
            environment: {
                "FEATURE_GROUP_NAME": props.featureGroupName,
                "FEATURE_NAME_S3URI": "source_ref",
                "INPUT_IMAGES_S3URI": `s3://${props.assetsBucket}/pipeline/assets/images/`,
                "QUERY_RESULTS_S3URI": `s3://${props.assetsBucket}/tmp/feature_store_query_results`,
            }
        });
        return missingLabelsLambda;
    }
    createRunLabelingJobLambda(props, role) {
        return new lambda_python.PythonFunction(this, 'RunLabelingJobLambda', {
            entry: 'lib/lambda/run_labeling_job',
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.PYTHON_3_11,
            architecture: aws_lambda_1.Architecture.X86_64,
            timeout: aws_cdk_lib_1.Duration.seconds(300),
            role: role,
            environment: {
                "BUCKET": props.assetsBucket,
                "PREFIX": "pipeline/assets",
                "ROLE": role.roleArn,
                "USE_PRIVATE_WORKTEAM": String(props.usePrivateWorkteamForLabeling),
                "PRIVATE_WORKTEAM_ARN": props.labelingJobPrivateWorkteamArn,
                "MAX_LABELS": props.maxLabelsPerLabelingJob.toString()
            }
        });
    }
    createRunVerificationJobLambda(props, role) {
        {
            return new lambda_python.PythonFunction(this, 'RunVerificationJobLambda', {
                entry: 'lib/lambda/run_verification_job',
                architecture: aws_lambda_1.Architecture.X86_64,
                runtime: aws_cdk_lib_1.aws_lambda.Runtime.PYTHON_3_11,
                timeout: aws_cdk_lib_1.Duration.seconds(300),
                role: role,
                environment: {
                    "BUCKET": props.assetsBucket,
                    "PREFIX": "pipeline/assets",
                    "ROLE": role.roleArn,
                    "USE_PRIVATE_WORKTEAM": String(props.usePrivateWorkteamForVerification),
                    "PRIVATE_WORKTEAM_ARN": props.verificationJobPrivateWorkteamArn,
                }
            });
        }
    }
}
exports.PipelineAssets = PipelineAssets;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFiZWxpbmctcGlwZWxpbmUtYXNzZXRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibGFiZWxpbmctcGlwZWxpbmUtYXNzZXRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLGtFQUFrRTtBQUNsRSw2Q0FBK0Y7QUFDL0YsdURBQTJFO0FBQzNFLDJDQUF1QztBQUN2Qyw2QkFBNkI7QUFLN0I7O0dBRUc7QUFDSCxNQUFhLGNBQWUsU0FBUSxzQkFBUztJQVMzQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWdDO1FBQ3hFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsa0RBQWtEO1FBQ2xELE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsQ0FBQTtRQUNyRCxnREFBZ0Q7UUFDaEQsSUFBSSxDQUFDLDJCQUEyQixHQUFHLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxLQUFLLEVBQUUsYUFBYSxDQUFDLENBQUE7UUFDdkYsNkRBQTZEO1FBQzdELElBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLENBQUMsOEJBQThCLENBQUMsS0FBSyxFQUFFLGFBQWEsQ0FBQyxDQUFBO1FBQ3hGLHlEQUF5RDtRQUN6RCxJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDLDBCQUEwQixDQUFDLEtBQUssRUFBRSxhQUFhLENBQUMsQ0FBQTtRQUNoRixzREFBc0Q7UUFDdEQsSUFBSSxDQUFDLDJCQUEyQixHQUFHLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxLQUFLLEVBQUUsYUFBYSxDQUFDLENBQUE7SUFDeEYsQ0FBQztJQUVELG1CQUFtQixDQUFDLEtBQWdDO1FBQ2xELE1BQU0sWUFBWSxHQUFHLElBQUkscUJBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLDRCQUE0QixFQUFFO1lBQ3BFLFNBQVMsRUFBRSxJQUFJLHFCQUFHLENBQUMsa0JBQWtCLENBQ25DLElBQUkscUJBQUcsQ0FB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RixDQUFDLENBQUM7SUFFTCxDQUFDO0lBR0QsOEJBQThCLENBQUMsS0FBZ0MsRUFBRSxJQUFjO1FBQzdFO1lBQ0UsT0FBTyxJQUFJLGFBQWEsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLDBCQUEwQixFQUFFO2dCQUN4RSxLQUFLLEVBQUUsaUNBQWlDO2dCQUN4QyxZQUFZLEVBQUUseUJBQVksQ0FBQyxNQUFNO2dCQUNqQyxPQUFPLEVBQUUsd0JBQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztnQkFDbkMsT0FBTyxFQUFFLHNCQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQztnQkFDOUIsSUFBSSxFQUFFLElBQUk7Z0JBQ1YsV0FBVyxFQUFFO29CQUNYLFFBQVEsRUFBRSxLQUFLLENBQUMsWUFBWTtvQkFDNUIsUUFBUSxFQUFFLGlCQUFpQjtvQkFDM0IsTUFBTSxFQUFFLElBQUksQ0FBQyxPQUFPO29CQUNwQixzQkFBc0IsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLGlDQUFpQyxDQUFDO29CQUN2RSxzQkFBc0IsRUFBRSxLQUFLLENBQUMsaUNBQWlDO2lCQUNoRTthQUNGLENBQUMsQ0FBQztTQUdKO0lBRUgsQ0FBQztDQUNGO0FBMUlELHdDQTBJQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGxhbWJkYV9weXRob24gZnJvbSAnQGF3cy1jZGsvYXdzLWxhbWJkYS1weXRob24tYWxwaGEnO1xuaW1wb3J0IHsgYXdzX2lhbSBhcyBpYW0sIGF3c19sYW1iZGEgYXMgbGFtYmRhLCBDZm5PdXRwdXQsIER1cmF0aW9uLCBTdGFjayB9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IEFyY2hpdGVjdHVyZSwgRG9ja2VySW1hZ2VGdW5jdGlvbiB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgeyBTdGF0ZU1hY2hpbmVQaXBlbGluZVByb3BzIH0gZnJvbSAnLi4vc3RhY2tzL3N0YXRlbWFjaGluZS1waXBlbGluZSc7XG5cblxuXG4vKipcbiAqIENvbnN0cnVjdCB0byBjcmVhdGUgYWxsIHN1cHBvcnRpbmcgYXJ0aWZhY3RzIHJlcXVpcmVkIGZvciBTdGVwRnVuY3Rpb24gZXhleHV0aW9uXG4gKi9cbmV4cG9ydCBjbGFzcyBQaXBlbGluZUFzc2V0cyBleHRlbmRzIENvbnN0cnVjdCB7XG5cbiAgcHVibGljIHJlYWRvbmx5IHBpcGVsaW5lX3JvbGU6IENmbk91dHB1dDtcbiAgcHVibGljIHJlYWRvbmx5IGxhYmVsaW5nX2pvYl9sYW1iZGE6IGxhbWJkYV9weXRob24uUHl0aG9uRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSB2ZXJpZmljYXRpb25fam9iX2xhbWJkYTogbGFtYmRhX3B5dGhvbi5QeXRob25GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGNoZWNrX21pc3NpbmdfbGFiZWxzX2xhbWJkYTogRG9ja2VySW1hZ2VGdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHVwZGF0ZV9mZWF0dXJlX3N0b3JlX2xhbWJkYTogbGFtYmRhX3B5dGhvbi5QeXRob25GdW5jdGlvbjtcblxuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBTdGF0ZU1hY2hpbmVQaXBlbGluZVByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIGNyZWF0ZSBleGVjdXRpb24gcm9sZSBmb3Igc3RlcGZ1bmN0aW9uIHBpcGVsaW5lXG4gICAgY29uc3QgcGlwZWxpbmVfcm9sZSA9IHRoaXMuY3JlYXRlRXhlY3V0aW9uUm9sZShwcm9wcylcbiAgICAvLyBjcmVhdGUgbGFtYmRhIHdoaWNoIGNoZWNrcyBmb3IgbWlzc2luZyBsYWJlbHNcbiAgICB0aGlzLmNoZWNrX21pc3NpbmdfbGFiZWxzX2xhbWJkYSA9IHRoaXMuY3JlYXRlTWlzc2luZ0xhYmVsc0xhbWJkYShwcm9wcywgcGlwZWxpbmVfcm9sZSlcbiAgICAvL2NyZWF0ZSBsYW1iZGEgZnVuY3Rpb24gZm9yIFNNIEdyb3VuZCBUcnV0aCB2ZXJpZmljYXRpb24gam9iXG4gICAgdGhpcy52ZXJpZmljYXRpb25fam9iX2xhbWJkYSA9IHRoaXMuY3JlYXRlUnVuVmVyaWZpY2F0aW9uSm9iTGFtYmRhKHByb3BzLCBwaXBlbGluZV9yb2xlKVxuICAgIC8vY3JlYXRlIGxhbWJkYSBmdW5jdGlvbiBmb3IgU00gR3JvdW5kIFRydXRoIGxhYmVsaW5nIGpvYlxuICAgIHRoaXMubGFiZWxpbmdfam9iX2xhbWJkYSA9IHRoaXMuY3JlYXRlUnVuTGFiZWxpbmdKb2JMYW1iZGEocHJvcHMsIHBpcGVsaW5lX3JvbGUpXG4gICAgLy8gY3JlYXRlIGxhbWJkYSB3aGljaCB1cGRhdGVzIGxhYmVscyBpbiBmZWF0dXJlIHN0b3JlXG4gICAgdGhpcy51cGRhdGVfZmVhdHVyZV9zdG9yZV9sYW1iZGEgPSB0aGlzLnVwZGF0ZUZlYXR1cmVTdG9yZUxhbWJkYShwcm9wcywgcGlwZWxpbmVfcm9sZSlcbiAgfVxuXG4gIGNyZWF0ZUV4ZWN1dGlvblJvbGUocHJvcHM6IFN0YXRlTWFjaGluZVBpcGVsaW5lUHJvcHMpIHtcbiAgICBjb25zdCBwaXBlbGluZVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ1N0ZXBGdW5jdGlvbnNFeGVjdXRpb25Sb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkNvbXBvc2l0ZVByaW5jaXBhbChcbiAgICAgICAgbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdzYWdlbWFrZXIuYW1hem9uYXdzLmNvbScpLFxuICAgICAgICBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJylcbiAgICAgIClcbiAgICB9KTtcblxuXG5cbiAgICBwaXBlbGluZVJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgIGFjdGlvbnM6IFsgJ3NhZ2VtYWtlcjpEZXNjcmliZUxhYmVsaW5nSm9iJywgJ2Nsb3Vkd2F0Y2g6RGVzY3JpYmVMb2dTdHJlYW1zJywgJ2Nsb3Vkd2F0Y2g6Q3JlYXRlTG9nR3JvdXAnLCAnY2xvdWR3YXRjaDpDcmVhdGVMb2dTdHJlYW0nLCAnbG9nczpQdXRMb2dFdmVudHMnLCAnc3RhdGVzOlN0YXJ0RXhlY3V0aW9uJ10sXG4gICAgfSkpO1xuXG4gICAgcGlwZWxpbmVSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOnMzOjo6JHtwcm9wcy5hc3NldHNCdWNrZXR9YCwgYGFybjphd3M6czM6Ojoke3Byb3BzLmFzc2V0c0J1Y2tldH0vKmBdLFxuICAgICAgYWN0aW9uczogWydzMzoqJ10sXG4gICAgfSkpO1xuXG4gICAgcGlwZWxpbmVSb2xlLmFkZE1hbmFnZWRQb2xpY3koIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21NYW5hZ2VkUG9saWN5QXJuKHRoaXMsJ1MzUmVhZE9ubHlQb2xpY3knLCAnYXJuOmF3czppYW06OmF3czpwb2xpY3kvQW1hem9uUzNSZWFkT25seUFjY2VzcycpKVxuXG4gICAgcGlwZWxpbmVSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOmF0aGVuYToke1N0YWNrLm9mKHRoaXMpLnJlZ2lvbn06JHtTdGFjay5vZih0aGlzKS5hY2NvdW50fTp3b3JrZ3JvdXAvcHJpbWFyeWBdLFxuICAgICAgYWN0aW9uczogWydhdGhlbmE6U3RhcnRRdWVyeUV4ZWN1dGlvbicsICdhdGhlbmE6R2V0UXVlcnlFeGVjdXRpb24nLCAnYXRoZW5hOkdldFF1ZXJ5UmVzdWx0cycsICdhdGhlbmE6U3RvcFF1ZXJ5RXhlY3V0aW9uJywgJ2F0aGVuYTpHZXRXb3JrR3JvdXAnXVxuICAgIH0pKTtcblxuICAgIHBpcGVsaW5lUm9sZS5hZGRNYW5hZ2VkUG9saWN5KGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQW1hem9uU2FnZU1ha2VyRnVsbEFjY2VzcycpKVxuICAgIC8vcGlwZWxpbmVSb2xlLmFkZE1hbmFnZWRQb2xpY3koaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhVlBDQWNjZXNzRXhlY3V0aW9uUm9sZScpKVxuICAgIHBpcGVsaW5lUm9sZS5hZGRNYW5hZ2VkUG9saWN5KGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpKVxuXG4gICAgcmV0dXJuIHBpcGVsaW5lUm9sZTtcbiAgfVxuXG4gIHVwZGF0ZUZlYXR1cmVTdG9yZUxhbWJkYShwcm9wczogU3RhdGVNYWNoaW5lUGlwZWxpbmVQcm9wcywgcm9sZTogaWFtLlJvbGUpIHtcbiAgICByZXR1cm4gbmV3IGxhbWJkYS5Eb2NrZXJJbWFnZUZ1bmN0aW9uKHRoaXMsICdVcGRhdGVGZWF0dXJlU3RvcmVMYW1iZGEnLCB7XG4gICAgICBjb2RlOiBsYW1iZGEuRG9ja2VySW1hZ2VDb2RlLmZyb21JbWFnZUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9sYW1iZGEvdXBkYXRlX2ZlYXR1cmVfc3RvcmUnKSksXG4gICAgICBhcmNoaXRlY3R1cmU6IEFyY2hpdGVjdHVyZS5YODZfNjQsXG4gICAgICBmdW5jdGlvbk5hbWU6IFwiVXBkYXRlTGFiZWxzSW5GZWF0dXJlU3RvcmVGdW5jdGlvblwiLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLnNlY29uZHMoNjAwKSxcbiAgICAgIHJvbGU6IHJvbGUsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBcIlJPTEVcIjogcm9sZS5yb2xlQXJuLFxuICAgICAgICBcIkZFQVRVUkVfR1JPVVBfTkFNRVwiOiBwcm9wcy5mZWF0dXJlR3JvdXBOYW1lLFxuICAgICAgICBcIkZFQVRVUkVfTkFNRV9TM1VSSVwiOiBcInNvdXJjZV9yZWZcIixcbiAgICAgICAgXCJGRUFUVVJFX1NUT1JFX1MzVVJJXCI6IGBzMzovLyR7cHJvcHMuYXNzZXRzQnVja2V0fS9mZWF0dXJlLXN0b3JlL2AsXG4gICAgICAgIFwiUVVFUllfUkVTVUxUU19TM1VSSVwiOiBgczM6Ly8ke3Byb3BzLmFzc2V0c0J1Y2tldH0vdG1wL2ZlYXR1cmVfc3RvcmVfcXVlcnlfcmVzdWx0c2AsXG4gICAgICB9XG4gICAgfSk7XG5cbiAgfVxuXG4gIGNyZWF0ZU1pc3NpbmdMYWJlbHNMYW1iZGEocHJvcHM6IFN0YXRlTWFjaGluZVBpcGVsaW5lUHJvcHMsIHJvbGU6IGlhbS5Sb2xlKSB7XG4gICAgY29uc3QgbWlzc2luZ0xhYmVsc0xhbWJkYSA9IG5ldyBsYW1iZGEuRG9ja2VySW1hZ2VGdW5jdGlvbih0aGlzLCAnQ2hlY2tNaXNzaW5nTGFiZWxzRnVuY3Rpb24nLCB7XG4gICAgICBjb2RlOiBsYW1iZGEuRG9ja2VySW1hZ2VDb2RlLmZyb21JbWFnZUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9sYW1iZGEvY2hlY2tfbWlzc2luZ19sYWJlbHMnKSksXG4gICAgICBhcmNoaXRlY3R1cmU6IEFyY2hpdGVjdHVyZS5YODZfNjQsXG4gICAgICBmdW5jdGlvbk5hbWU6IFwiQ2hlY2tNaXNzaW5nTGFiZWxzRnVuY3Rpb25cIixcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsXG4gICAgICByb2xlOiByb2xlLFxuICAgICAgdGltZW91dDogRHVyYXRpb24uc2Vjb25kcygzMDApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgXCJGRUFUVVJFX0dST1VQX05BTUVcIjogcHJvcHMuZmVhdHVyZUdyb3VwTmFtZSxcbiAgICAgICAgXCJGRUFUVVJFX05BTUVfUzNVUklcIjogXCJzb3VyY2VfcmVmXCIsXG4gICAgICAgIFwiSU5QVVRfSU1BR0VTX1MzVVJJXCI6IGBzMzovLyR7cHJvcHMuYXNzZXRzQnVja2V0fS9waXBlbGluZS9hc3NldHMvaW1hZ2VzL2AsXG4gICAgICAgIFwiUVVFUllfUkVTVUxUU19TM1VSSVwiOiBgczM6Ly8ke3Byb3BzLmFzc2V0c0J1Y2tldH0vdG1wL2ZlYXR1cmVfc3RvcmVfcXVlcnlfcmVzdWx0c2AsXG4gICAgICB9XG4gICAgfSk7XG5cblxuICAgIHJldHVybiBtaXNzaW5nTGFiZWxzTGFtYmRhXG4gIH1cblxuICBjcmVhdGVSdW5MYWJlbGluZ0pvYkxhbWJkYShwcm9wczogU3RhdGVNYWNoaW5lUGlwZWxpbmVQcm9wcywgcm9sZTogaWFtLlJvbGUpIHtcbiAgICByZXR1cm4gbmV3IGxhbWJkYV9weXRob24uUHl0aG9uRnVuY3Rpb24odGhpcywgJ1J1bkxhYmVsaW5nSm9iTGFtYmRhJywge1xuICAgICAgZW50cnk6ICdsaWIvbGFtYmRhL3J1bl9sYWJlbGluZ19qb2InLCAvLyByZXF1aXJlZFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXG4gICAgICBhcmNoaXRlY3R1cmU6IEFyY2hpdGVjdHVyZS5YODZfNjQsXG4gICAgICB0aW1lb3V0OiBEdXJhdGlvbi5zZWNvbmRzKDMwMCksXG4gICAgICByb2xlOiByb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgXCJCVUNLRVRcIjogcHJvcHMuYXNzZXRzQnVja2V0LFxuICAgICAgICBcIlBSRUZJWFwiOiBcInBpcGVsaW5lL2Fzc2V0c1wiLFxuICAgICAgICBcIlJPTEVcIjogcm9sZS5yb2xlQXJuLFxuICAgICAgICBcIlVTRV9QUklWQVRFX1dPUktURUFNXCI6IFN0cmluZyhwcm9wcy51c2VQcml2YXRlV29ya3RlYW1Gb3JMYWJlbGluZyksXG4gICAgICAgIFwiUFJJVkFURV9XT1JLVEVBTV9BUk5cIjogcHJvcHMubGFiZWxpbmdKb2JQcml2YXRlV29ya3RlYW1Bcm4sXG4gICAgICAgIFwiTUFYX0xBQkVMU1wiOiBwcm9wcy5tYXhMYWJlbHNQZXJMYWJlbGluZ0pvYi50b1N0cmluZygpXG4gICAgICB9XG4gICAgfSk7XG5cbiAgfVxuXG5cbiAgY3JlYXRlUnVuVmVyaWZpY2F0aW9uSm9iTGFtYmRhKHByb3BzOiBTdGF0ZU1hY2hpbmVQaXBlbGluZVByb3BzLCByb2xlOiBpYW0uUm9sZSkge1xuICAgIHtcbiAgICAgIHJldHVybiBuZXcgbGFtYmRhX3B5dGhvbi5QeXRob25GdW5jdGlvbih0aGlzLCAnUnVuVmVyaWZpY2F0aW9uSm9iTGFtYmRhJywge1xuICAgICAgICBlbnRyeTogJ2xpYi9sYW1iZGEvcnVuX3ZlcmlmaWNhdGlvbl9qb2InLCAvLyByZXF1aXJlZFxuICAgICAgICBhcmNoaXRlY3R1cmU6IEFyY2hpdGVjdHVyZS5YODZfNjQsXG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgICB0aW1lb3V0OiBEdXJhdGlvbi5zZWNvbmRzKDMwMCksXG4gICAgICAgIHJvbGU6IHJvbGUsXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgXCJCVUNLRVRcIjogcHJvcHMuYXNzZXRzQnVja2V0LFxuICAgICAgICAgIFwiUFJFRklYXCI6IFwicGlwZWxpbmUvYXNzZXRzXCIsXG4gICAgICAgICAgXCJST0xFXCI6IHJvbGUucm9sZUFybixcbiAgICAgICAgICBcIlVTRV9QUklWQVRFX1dPUktURUFNXCI6IFN0cmluZyhwcm9wcy51c2VQcml2YXRlV29ya3RlYW1Gb3JWZXJpZmljYXRpb24pLFxuICAgICAgICAgIFwiUFJJVkFURV9XT1JLVEVBTV9BUk5cIjogcHJvcHMudmVyaWZpY2F0aW9uSm9iUHJpdmF0ZVdvcmt0ZWFtQXJuLFxuICAgICAgICB9XG4gICAgICB9KTtcblxuXG4gICAgfVxuXG4gIH1cbn1cbiJdfQ==