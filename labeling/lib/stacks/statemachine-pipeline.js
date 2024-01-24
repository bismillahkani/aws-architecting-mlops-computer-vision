"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecuteStateMachinePipeline = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_codepipeline_actions_1 = require("aws-cdk-lib/aws-codepipeline-actions");
const aws_s3_1 = require("aws-cdk-lib/aws-s3");
const sfn = require("aws-cdk-lib/aws-stepfunctions");
const tasks = require("aws-cdk-lib/aws-stepfunctions-tasks");
const labeling_pipeline_assets_1 = require("../constructs/labeling-pipeline-assets");
class ExecuteStateMachinePipeline extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id);
        //deploy all assets required by the labeling pipeline
        const pipelineAssets = new labeling_pipeline_assets_1.PipelineAssets(this, 'LabelingPipelineAssets', props);
        const stateMachine = new sfn.StateMachine(this, 'Labeling', {
            definition: this.getStateMachineDefinition(pipelineAssets),
            stateMachineName: 'Quality-Inspection-Labeling'
        });
        const stepFunctionAction = new aws_cdk_lib_1.aws_codepipeline_actions.StepFunctionInvokeAction({
            actionName: 'Invoke',
            stateMachine: stateMachine,
            stateMachineInput: aws_cdk_lib_1.aws_codepipeline_actions.StateMachineInput.literal({}),
        });
        const labelingExecutionPipeline = new aws_cdk_lib_1.aws_codepipeline.Pipeline(this, 'LabelingExecutionPipeline', {
            artifactBucket: aws_s3_1.Bucket.fromBucketName(this, "artifactsbucket", props.assetsBucket),
            pipelineName: 'MlOpsEdge-Labeling-Pipeline',
            crossAccountKeys: false,
            stages: [
                {
                    stageName: 'Source',
                    actions: [this.getCodeSource(props)],
                },
                {
                    stageName: 'RunLabelingPipeline',
                    actions: [stepFunctionAction],
                },
            ],
        });
        this.labelingPipelineName = new aws_cdk_lib_1.CfnOutput(this, 'LabelingPipelineNameExport', {
            value: labelingExecutionPipeline.pipelineName
        });
    }
    getCodeSource(props) {
        const sourceOutput = new aws_cdk_lib_1.aws_codepipeline.Artifact();
        if (props.repoType == "CODECOMMIT" || props.repoType == "CODECOMMIT_PROVIDED") {
            const repository = aws_cdk_lib_1.aws_codecommit.Repository.fromRepositoryName(this, 'repository', props.repoName);
            return new aws_cdk_lib_1.aws_codepipeline_actions.CodeCommitSourceAction({
                actionName: 'CodeCommit',
                repository,
                branch: props.branchName,
                output: sourceOutput,
                trigger: aws_codepipeline_actions_1.CodeCommitTrigger.NONE,
            });
        }
        else {
            return new aws_cdk_lib_1.aws_codepipeline_actions.CodeStarConnectionsSourceAction({
                actionName: `${props.githubRepoOwner}_${props.repoName}`,
                branch: props.branchName,
                output: sourceOutput,
                owner: props.githubRepoOwner,
                repo: props.repoName,
                connectionArn: props.githubConnectionArn,
                // not triggering ad the pipeline will be triggered by infrastructure pipeline anyways
                triggerOnPush: false,
            });
        }
    }
    /**
     * Defines the statemachine which executes the labeling workflow
     * @param pipelineAssets
     * @returns StateMachineDefintion
     */
    getStateMachineDefinition(pipelineAssets) {
        const success = new sfn.Succeed(this, "Labeling Pipeline execution succeeded");
        const fail = new sfn.Fail(this, "Labeling Pipeline execution failed");
        const checkMissingLabels = new tasks.LambdaInvoke(this, "CheckMissingLabels", {
            lambdaFunction: pipelineAssets.check_missing_labels_lambda
        });
        const updateFeatureStore = new tasks.LambdaInvoke(this, "UpdateLabelsInFeatureStore", {
            lambdaFunction: pipelineAssets.update_feature_store_lambda,
            payload: sfn.TaskInput.fromObject({
                executionId: sfn.JsonPath.stringAt('$$.Execution.Id'),
                verification_job_output: sfn.JsonPath.stringAt('$.LabelingJobOutput.OutputDatasetS3Uri'),
            }),
        });
        const runLabelingJob = new tasks.LambdaInvoke(this, "StartLabelingJob", {
            lambdaFunction: pipelineAssets.labeling_job_lambda,
            payload: sfn.TaskInput.fromObject({
                executionId: sfn.JsonPath.stringAt('$$.Execution.Id'),
                request: sfn.JsonPath.entirePayload,
            }),
            outputPath: '$.Payload',
        });
        const runVerificationJob = new tasks.LambdaInvoke(this, "StartVerificationJob", {
            lambdaFunction: pipelineAssets.verification_job_lambda,
            payload: sfn.TaskInput.fromObject({
                executionId: sfn.JsonPath.stringAt('$$.Execution.Id'),
                input_manifest: sfn.JsonPath.stringAt('$.LabelingJobOutput.OutputDatasetS3Uri'),
            }),
            outputPath: '$.Payload',
        });
        // first run check missing labels lambda
        const definition = checkMissingLabels
            .next(new sfn.Choice(this, 'Missing Labels?')
            // if all images are labeled, end pipeline
            .when(sfn.Condition.numberEquals('$.Payload.missing_labels_count', 0), success).
            otherwise(runLabelingJob
            // otherwise run labeling job
            .next(this.createLabelingJobWaiter('LabelingJob', fail, runVerificationJob
            //then run verification job and update labels in feature store
            .next(this.createLabelingJobWaiter('VerificationJob', fail, updateFeatureStore
            .next(success)))))));
        return definition;
    }
    createLabelingJobWaiter(labelingJobName, fail, next) {
        const getLabelingJobStatus = new tasks.CallAwsService(this, `Get ${labelingJobName} status`, {
            service: 'sagemaker',
            action: 'describeLabelingJob',
            parameters: {
                LabelingJobName: sfn.JsonPath.stringAt('$.LabelingJobName')
            },
            iamResources: ['*'],
        });
        const waitX = new sfn.Wait(this, `Waiting for - ${labelingJobName} - completion`, {
            time: sfn.WaitTime.duration(aws_cdk_lib_1.Duration.seconds(30)),
        });
        return waitX.next(getLabelingJobStatus).next(new sfn.Choice(this, `${labelingJobName} Complete?`)
            // Look at the "status" field
            .when(sfn.Condition.stringEquals('$.LabelingJobStatus', 'Failed'), fail)
            .when(sfn.Condition.stringEquals('$.LabelingJobStatus', 'Stopped'), fail)
            .when(sfn.Condition.stringEquals('$.LabelingJobStatus', 'Completed'), next)
            .otherwise(waitX));
    }
}
exports.ExecuteStateMachinePipeline = ExecuteStateMachinePipeline;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGVtYWNoaW5lLXBpcGVsaW5lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic3RhdGVtYWNoaW5lLXBpcGVsaW5lLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZDQUlxQjtBQUNyQixtRkFBeUU7QUFDekUsK0NBQTRDO0FBQzVDLHFEQUFxRDtBQUNyRCw2REFBNkQ7QUFHN0QscUZBQXdFO0FBVXhFLE1BQWEsMkJBQTRCLFNBQVEsbUJBQUs7SUFHbEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFnQztRQUN0RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLHFEQUFxRDtRQUNyRCxNQUFNLGNBQWMsR0FBRyxJQUFJLHlDQUFjLENBQUMsSUFBSSxFQUFFLHdCQUF3QixFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRWpGLE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQ3hELFVBQVUsRUFBRSxJQUFJLENBQUMseUJBQXlCLENBQUMsY0FBYyxDQUFDO1lBQzFELGdCQUFnQixFQUFFLDZCQUE2QjtTQUNsRCxDQUFDLENBQUM7UUFFSCxNQUFNLGtCQUFrQixHQUFHLElBQUksc0NBQW9CLENBQUMsd0JBQXdCLENBQUM7WUFDekUsVUFBVSxFQUFFLFFBQVE7WUFDcEIsWUFBWSxFQUFFLFlBQVk7WUFDMUIsaUJBQWlCLEVBQUUsc0NBQW9CLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztTQUN4RSxDQUFDLENBQUM7UUFFSCxNQUFNLHlCQUF5QixHQUFHLElBQUksOEJBQVksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLDJCQUEyQixFQUFFO1lBQzNGLGNBQWMsRUFBRSxlQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRSxLQUFLLENBQUMsWUFBWSxDQUFDO1lBQ2xGLFlBQVksRUFBRSw2QkFBNkI7WUFD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SSxDQUFDO2FBQzFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFBO0lBRzFCLENBQUM7Q0FDSjtBQWpKRCxrRUFpSkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICAgIGF3c19jb2RlY29tbWl0IGFzIGNvZGVjb21taXQsXG4gICAgYXdzX2NvZGVwaXBlbGluZSBhcyBjb2RlcGlwZWxpbmUsXG4gICAgYXdzX2NvZGVwaXBlbGluZV9hY3Rpb25zIGFzIGNvZGVwaXBlbGluZV9hY3Rpb25zLCBDZm5PdXRwdXQsIER1cmF0aW9uLCBGbiwgU3RhY2tcbn0gZnJvbSBcImF3cy1jZGstbGliXCI7XG5pbXBvcnQgeyBDb2RlQ29tbWl0VHJpZ2dlciB9IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtY29kZXBpcGVsaW5lLWFjdGlvbnNcIjtcbmltcG9ydCB7IEJ1Y2tldCB9IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtczNcIjtcbmltcG9ydCAqIGFzIHNmbiBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3RlcGZ1bmN0aW9ucyc7XG5pbXBvcnQgKiBhcyB0YXNrcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3RlcGZ1bmN0aW9ucy10YXNrcyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xuXG5pbXBvcnQgeyBQaXBlbGluZUFzc2V0cyB9IGZyb20gXCIuLi9jb25zdHJ1Y3RzL2xhYmVsaW5nLXBpcGVsaW5lLWFzc2V0c1wiO1xuaW1wb3J0IHsgQXBwQ29uZmlnIH0gZnJvbSBcIi4uLy4uL2Jpbi9hcHBcIjtcblxuLyoqXG4gKiBTdGFjayB0byBjcmVhdGUgUGlwZWxpbmUgaW4gQ29kZXBpcGVsaW5lIHdoaWNoIGlzIHJlc3BvbnNpYmxlIHRvIGV4ZWN1dGUgU3RlcGZ1bmN0aW9ucyBTdGF0ZW1hY2hpbmVcbiAqL1xuXG5leHBvcnQgaW50ZXJmYWNlIFN0YXRlTWFjaGluZVBpcGVsaW5lUHJvcHMgZXh0ZW5kcyBBcHBDb25maWcge1xuICAgIHJlYWRvbmx5IGFzc2V0c0J1Y2tldDogc3RyaW5nO1xufVxuZXhwb3J0IGNsYXNzIEV4ZWN1dGVTdGF0ZU1hY2hpbmVQaXBlbGluZSBleHRlbmRzIFN0YWNrIHtcbiAgICBwdWJsaWMgcmVhZG9ubHkgbGFiZWxpbmdQaXBlbGluZU5hbWU6IENmbk91dHB1dDtcblxuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBTdGF0ZU1hY2hpbmVQaXBlbGluZVByb3BzKSB7XG4gICAgICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAgICAgLy9kZXBsb3kgYWxsIGFzc2V0cyByZXF1aXJlZCBieSB0aGUgbGFiZWxpbmcgcGlwZWxpbmVcbiAgICAgICAgY29uc3QgcGlwZWxpbmVBc3NldHMgPSBuZXcgUGlwZWxpbmVBc3NldHModGhpcywgJ0xhYmVsaW5nUGlwZWxpbmVBc3NldHMnLCBwcm9wcyk7XG5cbiAgICAgICAgY29uc3Qgc3RhdGVNYWNoaW5lID0gbmV3IHNmbi5TdGF0ZU1hY2hpbmUodGhpcywgJ0xhYmVsaW5nJywge1xuICAgICAgICAgICAgZGVmaW5pdGlvbjogdGhpcy5nZXRTdGF0ZU1hY2hpbmVEZWZpbml0aW9uKHBpcGVsaW5lQXNzZXRzKSxcbiAgICAgICAgICAgIHN0YXRlTWFjaGluZU5hbWU6ICdRdWFsaXR5LUluc3BlY3Rpb24tTGFiZWxpbmcnXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHN0ZXBGdW5jdGlvbkFjdGlvbiA9IG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5TdGVwRnVuY3Rpb25JbnZva2VBY3Rpb24oe1xuICAgICAgICAgICAgYWN0aW9uTmFtZTogJ0ludm9rZScsXG4gICAgICAgICAgICBzdGF0ZU1hY2hpbmU6IHN0YXRlTWFjaGluZSxcbiAgICAgICAgICAgIHN0YXRlTWFjaGluZUlucHV0OiBjb2RlcGlwZWxpbmVfYWN0aW9ucy5TdGF0ZU1hY2hpbmVJbnB1dC5saXRlcmFsKHt9KSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgbGFiZWxpbmdFeGVjdXRpb25QaXBlbGluZSA9IG5ldyBjb2RlcGlwZWxpbmUuUGlwZWxpbmUodGhpcywgJ0xhYmVsaW5nRXhlY3V0aW9uUGlwZWxpbmUnLCB7XG4gICAgICAgICAgICBhcnRpZmFjdEJ1Y2tldDogQnVja2V0LmZyb21CdWNrZXROYW1lKHRoaXMsIFwiYXJ0aWZhY3RzYnVja2V0XCIsIHByb3BzLmFzc2V0c0J1Y2tldCksXG4gICAgICAgICAgICBwaXBlbGluZU5hbWU6ICdNbE9wc0VkZ2UtTGFiZWxpbmctUGlwZWxpbmUnLFxuICAgICAgICAgICAgY3Jvc3NBY2NvdW50S2V5czogZmFsc2UsXG4gICAgICAgICAgICBzdGFnZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHN0YWdlTmFtZTogJ1NvdXJjZScsXG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbnM6IFt0aGlzLmdldENvZGVTb3VyY2UocHJvcHMpXSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhZ2VOYW1lOiAnUnVuTGFiZWxpbmdQaXBlbGluZScsXG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbnM6IFtzdGVwRnVuY3Rpb25BY3Rpb25dLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmxhYmVsaW5nUGlwZWxpbmVOYW1lID0gbmV3IENmbk91dHB1dCh0aGlzLCAnTGFiZWxpbmdQaXBlbGluZU5hbWVFeHBvcnQnLCB7XG4gICAgICAgICAgICB2YWx1ZTogbGFiZWxpbmdFeGVjdXRpb25QaXBlbGluZS5waXBlbGluZU5hbWVcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZ2V0Q29kZVNvdXJjZShwcm9wczogQXBwQ29uZmlnKSB7XG4gICAgICAgIGNvbnN0IHNvdXJjZU91dHB1dCA9IG5ldyBjb2RlcGlwZWxpbmUuQXJ0aWZhY3QoKTtcbiAgICAgICAgaWYgKHByb3BzLnJlcG9UeXBlID09IFwiQ09ERUNPTU1JVFwiIHx8IHByb3BzLnJlcG9UeXBlID09IFwiQ09ERUNPTU1JVF9QUk9WSURFRFwiKSB7XG4gICAgICAgICAgICBjb25zdCByZXBvc2l0b3J5ID0gY29kZWNvbW1pdC5SZXBvc2l0b3J5LmZyb21SZXBvc2l0b3J5TmFtZSh0aGlzLCAncmVwb3NpdG9yeScsIHByb3BzLnJlcG9OYW1lKVxuICAgICAgICAgICAgcmV0dXJuIG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5Db2RlQ29tbWl0U291cmNlQWN0aW9uKHtcbiAgICAgICAgICAgICAgICBhY3Rpb25OYW1lOiAnQ29kZUNvbW1pdCcsXG4gICAgICAgICAgICAgICAgcmVwb3NpdG9yeSxcbiAgICAgICAgICAgICAgICBicmFuY2g6IHByb3BzLmJyYW5jaE5hbWUsXG4gICAgICAgICAgICAgICAgb3V0cHV0OiBzb3VyY2VPdXRwdXQsXG4gICAgICAgICAgICAgICAgdHJpZ2dlcjogQ29kZUNvbW1pdFRyaWdnZXIuTk9ORSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5Db2RlU3RhckNvbm5lY3Rpb25zU291cmNlQWN0aW9uKHtcbiAgICAgICAgICAgICAgICBhY3Rpb25OYW1lOiBgJHtwcm9wcy5naXRodWJSZXBvT3duZXJ9XyR7cHJvcHMucmVwb05hbWV9YCxcbiAgICAgICAgICAgICAgICBicmFuY2g6IHByb3BzLmJyYW5jaE5hbWUsXG4gICAgICAgICAgICAgICAgb3V0cHV0OiBzb3VyY2VPdXRwdXQsXG4gICAgICAgICAgICAgICAgb3duZXI6IHByb3BzLmdpdGh1YlJlcG9Pd25lcixcbiAgICAgICAgICAgICAgICByZXBvOiBwcm9wcy5yZXBvTmFtZSxcbiAgICAgICAgICAgICAgICBjb25uZWN0aW9uQXJuOiBwcm9wcy5naXRodWJDb25uZWN0aW9uQXJuLFxuICAgICAgICAgICAgICAgIC8vIG5vdCB0cmlnZ2VyaW5nIGFkIHRoZSBwaXBlbGluZSB3aWxsIGJlIHRyaWdnZXJlZCBieSBpbmZyYXN0cnVjdHVyZSBwaXBlbGluZSBhbnl3YXlzXG4gICAgICAgICAgICAgICAgdHJpZ2dlck9uUHVzaDogZmFsc2UsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBEZWZpbmVzIHRoZSBzdGF0ZW1hY2hpbmUgd2hpY2ggZXhlY3V0ZXMgdGhlIGxhYmVsaW5nIHdvcmtmbG93XG4gICAgICogQHBhcmFtIHBpcGVsaW5lQXNzZXRzIFxuICAgICAqIEByZXR1cm5zIFN0YXRlTWFjaGluZURlZmludGlvblxuICAgICAqL1xuICAgIGdldFN0YXRlTWFjaGluZURlZmluaXRpb24ocGlwZWxpbmVBc3NldHM6IFBpcGVsaW5lQXNzZXRzKSB7XG5cbiAgICAgICAgY29uc3Qgc3VjY2VzcyA9IG5ldyBzZm4uU3VjY2VlZCh0aGlzLCBcIkxhYmVsaW5nIFBpcGVsaW5lIGV4ZWN1dGlvbiBzdWNjZWVkZWRcIilcbiAgICAgICAgY29uc3QgZmFpbCA9IG5ldyBzZm4uRmFpbCh0aGlzLCBcIkxhYmVsaW5nIFBpcGVsaW5lIGV4ZWN1dGlvbiBmYWlsZWRcIilcblxuXG4gICAgICAgIGNvbnN0IGNoZWNrTWlzc2luZ0xhYmVscyA9IG5ldyB0YXNrcy5MYW1iZGFJbnZva2UodGhpcywgXCJDaGVja01pc3NpbmdMYWJlbHNcIiwge1xuICAgICAgICAgICAgbGFtYmRhRnVuY3Rpb246IHBpcGVsaW5lQXNzZXRzLmNoZWNrX21pc3NpbmdfbGFiZWxzX2xhbWJkYVxuICAgICAgICB9KVxuXG4gICAgICAgIGNvbnN0IHVwZGF0ZUZlYXR1cmVTdG9yZSA9IG5ldyB0YXNrcy5MYW1iZGFJbnZva2UodGhpcywgXCJVcGRhdGVMYWJlbHNJbkZlYXR1cmVTdG9yZVwiLCB7XG4gICAgICAgICAgICBsYW1iZGFGdW5jdGlvbjogcGlwZWxpbmVBc3NldHMudXBkYXRlX2ZlYXR1cmVfc3RvcmVfbGFtYmRhLFxuICAgICAgICAgICAgcGF5bG9hZDogc2ZuLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICAgICAgICAgICBleGVjdXRpb25JZDogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckJC5FeGVjdXRpb24uSWQnKSxcbiAgICAgICAgICAgICAgICB2ZXJpZmljYXRpb25fam9iX291dHB1dDogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLkxhYmVsaW5nSm9iT3V0cHV0Lk91dHB1dERhdGFzZXRTM1VyaScpLFxuICAgICAgICAgICAgfSksXG4gICAgICAgIH0pXG4gICAgICAgIGNvbnN0IHJ1bkxhYmVsaW5nSm9iID0gbmV3IHRhc2tzLkxhbWJkYUludm9rZSh0aGlzLCBcIlN0YXJ0TGFiZWxpbmdKb2JcIiwge1xuICAgICAgICAgICAgbGFtYmRhRnVuY3Rpb246IHBpcGVsaW5lQXNzZXRzLmxhYmVsaW5nX2pvYl9sYW1iZGEsXG4gICAgICAgICAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xuICAgICAgICAgICAgICAgIGV4ZWN1dGlvbklkOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQkLkV4ZWN1dGlvbi5JZCcpLFxuICAgICAgICAgICAgICAgIHJlcXVlc3Q6IHNmbi5Kc29uUGF0aC5lbnRpcmVQYXlsb2FkLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBvdXRwdXRQYXRoOiAnJC5QYXlsb2FkJyxcbiAgICAgICAgfSlcbiAgICAgICAgY29uc3QgcnVuVmVyaWZpY2F0aW9uSm9iID0gbmV3IHRhc2tzLkxhbWJkYUludm9rZSh0aGlzLCBcIlN0YXJ0VmVyaWZpY2F0aW9uSm9iXCIsIHtcbiAgICAgICAgICAgIGxhbWJkYUZ1bmN0aW9uOiBwaXBlbGluZUFzc2V0cy52ZXJpZmljYXRpb25fam9iX2xhbWJkYSxcbiAgICAgICAgICAgIHBheWxvYWQ6IHNmbi5UYXNrSW5wdXQuZnJvbU9iamVjdCh7XG4gICAgICAgICAgICAgICAgZXhlY3V0aW9uSWQ6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJCQuRXhlY3V0aW9uLklkJyksXG4gICAgICAgICAgICAgICAgaW5wdXRfbWFuaWZlc3Q6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5MYWJlbGluZ0pvYk91dHB1dC5PdXRwdXREYXRhc2V0UzNVcmknKSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgb3V0cHV0UGF0aDogJyQuUGF5bG9hZCcsXG4gICAgICAgIH0pXG5cbiAgICAgICAgLy8gZmlyc3QgcnVuIGNoZWNrIG1pc3NpbmcgbGFiZWxzIGxhbWJkYVxuICAgICAgICBjb25zdCBkZWZpbml0aW9uID0gY2hlY2tNaXNzaW5nTGFiZWxzXG5cbiAgICAgICAgICAgIC5uZXh0KG5ldyBzZm4uQ2hvaWNlKHRoaXMsICdNaXNzaW5nIExhYmVscz8nKVxuICAgICAgICAgICAgICAgIC8vIGlmIGFsbCBpbWFnZXMgYXJlIGxhYmVsZWQsIGVuZCBwaXBlbGluZVxuICAgICAgICAgICAgICAgIC53aGVuKHNmbi5Db25kaXRpb24ubnVtYmVyRXF1YWxzKCckLlBheWxvYWQubWlzc2luZ19sYWJlbHNfY291bnQnLCAwKSwgc3VjY2VzcykuXG4gICAgICAgICAgICAgICAgb3RoZXJ3aXNlKHJ1bkxhYmVsaW5nSm9iXG4gICAgICAgICAgICAgICAgICAgIC8vIG90aGVyd2lzZSBydW4gbGFiZWxpbmcgam9iXG4gICAgICAgICAgICAgICAgICAgIC5uZXh0KHRoaXMuY3JlYXRlTGFiZWxpbmdKb2JXYWl0ZXIoJ0xhYmVsaW5nSm9iJywgZmFpbCwgcnVuVmVyaWZpY2F0aW9uSm9iXG4gICAgICAgICAgICAgICAgICAgICAgICAvL3RoZW4gcnVuIHZlcmlmaWNhdGlvbiBqb2IgYW5kIHVwZGF0ZSBsYWJlbHMgaW4gZmVhdHVyZSBzdG9yZVxuICAgICAgICAgICAgICAgICAgICAgICAgLm5leHQodGhpcy5jcmVhdGVMYWJlbGluZ0pvYldhaXRlcignVmVyaWZpY2F0aW9uSm9iJywgZmFpbCwgdXBkYXRlRmVhdHVyZVN0b3JlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLm5leHQoc3VjY2VzcykpKSkpKSlcblxuICAgICAgICByZXR1cm4gZGVmaW5pdGlvblxuICAgIH1cblxuICAgIGNyZWF0ZUxhYmVsaW5nSm9iV2FpdGVyKGxhYmVsaW5nSm9iTmFtZTogc3RyaW5nLCBmYWlsOiBzZm4uRmFpbCwgbmV4dDogc2ZuLklDaGFpbmFibGUpIHtcblxuICAgICAgICBjb25zdCBnZXRMYWJlbGluZ0pvYlN0YXR1cyA9IG5ldyB0YXNrcy5DYWxsQXdzU2VydmljZSh0aGlzLCBgR2V0ICR7bGFiZWxpbmdKb2JOYW1lfSBzdGF0dXNgLCB7XG4gICAgICAgICAgICBzZXJ2aWNlOiAnc2FnZW1ha2VyJyxcbiAgICAgICAgICAgIGFjdGlvbjogJ2Rlc2NyaWJlTGFiZWxpbmdKb2InLFxuICAgICAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgIExhYmVsaW5nSm9iTmFtZTogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLkxhYmVsaW5nSm9iTmFtZScpXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaWFtUmVzb3VyY2VzOiBbJyonXSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3Qgd2FpdFggPSBuZXcgc2ZuLldhaXQodGhpcywgYFdhaXRpbmcgZm9yIC0gJHtsYWJlbGluZ0pvYk5hbWV9IC0gY29tcGxldGlvbmAsIHtcblxuICAgICAgICAgICAgdGltZTogc2ZuLldhaXRUaW1lLmR1cmF0aW9uKER1cmF0aW9uLnNlY29uZHMoMzApKSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHdhaXRYLm5leHQoZ2V0TGFiZWxpbmdKb2JTdGF0dXMpLm5leHQobmV3IHNmbi5DaG9pY2UodGhpcywgYCR7bGFiZWxpbmdKb2JOYW1lfSBDb21wbGV0ZT9gKVxuICAgICAgICAgICAgLy8gTG9vayBhdCB0aGUgXCJzdGF0dXNcIiBmaWVsZFxuICAgICAgICAgICAgLndoZW4oc2ZuLkNvbmRpdGlvbi5zdHJpbmdFcXVhbHMoJyQuTGFiZWxpbmdKb2JTdGF0dXMnLCAnRmFpbGVkJyksIGZhaWwpXG4gICAgICAgICAgICAud2hlbihzZm4uQ29uZGl0aW9uLnN0cmluZ0VxdWFscygnJC5MYWJlbGluZ0pvYlN0YXR1cycsICdTdG9wcGVkJyksIGZhaWwpXG4gICAgICAgICAgICAud2hlbihzZm4uQ29uZGl0aW9uLnN0cmluZ0VxdWFscygnJC5MYWJlbGluZ0pvYlN0YXR1cycsICdDb21wbGV0ZWQnKSwgbmV4dClcbiAgICAgICAgICAgIC5vdGhlcndpc2Uod2FpdFgpKVxuXG5cbiAgICB9XG59XG5cblxuIl19