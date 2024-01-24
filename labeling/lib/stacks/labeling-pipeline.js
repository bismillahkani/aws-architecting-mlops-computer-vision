"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeployLabelingPipelineStage = exports.LabelingPipelineStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_events_targets_1 = require("aws-cdk-lib/aws-events-targets");
const pipelines_1 = require("aws-cdk-lib/pipelines");
const statemachine_pipeline_1 = require("./statemachine-pipeline");
const aws_events_1 = require("aws-cdk-lib/aws-events");
class LabelingPipelineStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        //pass in our artifacts bucket isntead of creating a new one
        const LabelingPipeline = new aws_cdk_lib_1.aws_codepipeline.Pipeline(this, 'LabelingPipeline', {
            pipelineName: 'MlOpsEdge-Labeling-Infra-Pipeline',
            artifactBucket: aws_cdk_lib_1.aws_s3.Bucket.fromBucketName(this, "mlops-bucket", props.assetsBucket),
            restartExecutionOnUpdate: true
        });
        const pipeline = new aws_cdk_lib_1.pipelines.CodePipeline(this, 'cdk-pipeline', {
            codePipeline: LabelingPipeline,
            codeBuildDefaults: {
                buildEnvironment: { privileged: true },
                rolePolicy: [new aws_cdk_lib_1.aws_iam.PolicyStatement({
                        actions: ['codepipeline:StartPipelineExecution'],
                        resources: ['*'],
                    })]
            },
            synth: new aws_cdk_lib_1.pipelines.ShellStep('Synth', {
                input: this.getCodeSource(props),
                commands: [
                    'cd labeling',
                    'npm ci',
                    'npm run build',
                    'npx cdk synth',
                ],
                primaryOutputDirectory: "labeling/cdk.out",
            })
        });
        const stage = new DeployLabelingPipelineStage(this, 'MLOps-Labeling', props);
        const triggerStep = new pipelines_1.ShellStep('InvokeLabelingPipeline', {
            envFromCfnOutputs: {
                PIPELINE_NAME: stage.piplineName
            },
            commands: [
                `aws codepipeline start-pipeline-execution --name $PIPELINE_NAME`
            ],
        });
        pipeline.addStage(stage, {
            post: [triggerStep]
        });
        // You need to construct the pipeline before passing it as a target in rule
        pipeline.buildPipeline();
        // create scheduled trigger for labeling pipeline
        const rule = new aws_events_1.Rule(this, 'Rule', {
            schedule: aws_events_1.Schedule.expression(props.labelingPipelineSchedule),
        });
        rule.addTarget(new aws_events_targets_1.CodePipeline(pipeline.pipeline));
    }
    getCodeSource(props) {
        if (props.repoType == "CODECOMMIT" || props.repoType == "CODECOMMIT_PROVIDED") {
            const repo = aws_cdk_lib_1.aws_codecommit.Repository.fromRepositoryName(this, 'ImportedRepo', props.repoName);
            return aws_cdk_lib_1.pipelines.CodePipelineSource.codeCommit(repo, props.branchName, {});
        }
        else {
            return aws_cdk_lib_1.pipelines.CodePipelineSource.connection(`${props.githubRepoOwner}/${props.repoName}`, props.branchName, { connectionArn: props.githubConnectionArn });
        }
    }
}
exports.LabelingPipelineStack = LabelingPipelineStack;
class DeployLabelingPipelineStage extends aws_cdk_lib_1.Stage {
    constructor(scope, id, props) {
        super(scope, id, props);
        const labelingPipelineStack = new statemachine_pipeline_1.ExecuteStateMachinePipeline(this, 'Statemachine-Pipeline-Stack', {
            ...props,
            stackName: "LabelingPipelineStack"
        });
        this.piplineName = labelingPipelineStack.labelingPipelineName;
    }
}
exports.DeployLabelingPipelineStage = DeployLabelingPipelineStage;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFiZWxpbmctcGlwZWxpbmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJsYWJlbGluZy1waXBlbGluZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2Q0FBK0o7QUFDL0osdUVBQThEO0FBQzlELHFEQUFrRDtBQUVsRCxtRUFBOEY7QUFDOUYsdURBQXdEO0FBR3hELE1BQWEscUJBQXNCLFNBQVEsbUJBQUs7SUFFNUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFnQjtRQUN0RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qiw0REFBNEQ7UUFDNUQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLDhCQUFZLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUN6RSxZQUFZLEVBQUUsbUNBQW1DO1lBQ2pELGNBQWMsRUFBRSxvQkFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRSxLQUFLLENBQUMsWUFBWSxDQUFDO1lBQ2xGLHdCQUF3QixFQUFFLElBQUk7U0FDakMsQ0FBQyxDQUFDO1FBR0gsTUFBTSxRQUFRLEdBQUcsSUFBSSx1QkFBUyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQzlELFlBQVksRUFBRSxnQkFBZ0I7WUFDOUIsaUJBQWlCLEVBQUU7Z0JBQ2YsZ0JBQWdCLEVBQUUsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFO2dCQUN0QyxVQUFVLEVBQUUsQ0FBQyxJQUFJLHFCQUFHLENBQUMsZUFBZSxDQUFDO3dCQUNqQyxPQUFPLEVBQUUsQ0FBQyxxQ0FBcUMsQ0FBQzt3QkFDaEQsU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDO3FCQUNuQixDQUFDLENBQUM7YUFDTjtZQUVELEtBQUssRUFBRSxJQUFJLHVCQUFTLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRTtnQkFDcEMsS0FBSyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDO2dCQUNoQyxRQUFRLEVBQUU7b0JBQ04sYUFBYTtvQkFDYixRQUFRO29CQUNSLGVBQWU7b0JBQ2YsZUFBZTtpQkFDbEI7Z0JBQ0Qsc0JBQXNCLEVBQUUsa0JBQWtCO2FBQzdDLENBQUM7U0FDTCxDQUFDLENBQUM7UUFFSCxNQUFNLEtBQUssR0FBRyxJQUFJLDJCQUEyQixDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUU3RSxNQUFNLFdBQVcsR0FBRyxJQUFJLHFCQUFTLENBQUMsd0JBQXdCLEVBQUU7WUFDeEQsaUJBQWlCLEVBQUU7Z0JBQ2YsYUFBYSxFQUFFLEtBQUssQ0FBQyxXQUFXO2FBQ25DO1lBQ0QsUUFBUSxFQUFFO2dCQUNOLGlFQUFpRTthQUNwRTtTQUNKLENBQUMsQ0FBQztRQUVILFFBQVEsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFO1lBQ3JCLElBQUksRUFBRSxDQUFDLFdBQVcsQ0FBQztTQUN0QixDQUFDLENBQUM7UUFDSCwyRUFBMkU7UUFDM0UsUUFBUSxDQUFDLGFBQWEsRUFBRSxDQUFBO1FBQ3hCLGlEQUFpRDtRQUNqRCxNQUFNLElBQUksR0FBRyxJQUFJLGlCQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRTtZQUNoQyxRQUFRLEVBQUUscUJBQVEsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLHdCQUF3QixDQUFDO1NBQ2hFLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxpQ0FBWSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQ3hELENBQUM7SUFFRCxhQUFhLENBQUMsS0FBZ0I7UUFFMUIsSUFBSSxLQUFLLENBQUMsUUFBUSxJQUFJLFlBQVksSUFBSSxLQUFLLENBQUMsUUFBUSxJQUFJLHFCQUFxQixFQUFFO1lBQzNFLE1BQU0sSUFBSSxHQUFHLDRCQUFVLENBQUMsVUFBVSxDQUFDLGtCQUFrQixDQUFDLElBQUksRUFBRSxjQUFjLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzVGLE9BQU8sdUJBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLENBQUE7U0FDN0U7YUFBTTtZQUNILE9BQU8sdUJBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsR0FBRyxLQUFLLENBQUMsZUFBZSxJQUFJLEtBQUssQ0FBQyxRQUFRLEVBQUUsRUFBRSxLQUFLLENBQUMsVUFBVSxFQUFFLEVBQUUsYUFBYSxFQUFFLEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxDQUFDLENBQUE7U0FDL0o7SUFDTCxDQUFDO0NBQ0o7QUFuRUQsc0RBbUVDO0FBR0QsTUFBYSwyQkFBNEIsU0FBUSxtQkFBSztJQUlsRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWdCO1FBQ3RELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxtREFBb0IsQ0FBQyxJQUFJLEVBQUUsNkJBQTZCLEVBQUU7WUFDeEYsR0FBRyxLQUFLO1lBQ1IsU0FBUyxFQUFFLHVCQUF1QjtTQUNyQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsV0FBVyxHQUFHLHFCQUFxQixDQUFDLG9CQUFvQixDQUFDO0lBRWxFLENBQUM7Q0FDSjtBQWRELGtFQWNDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ2ZuT3V0cHV0LCBTdGFjaywgU3RhZ2UsIGF3c19jb2RlY29tbWl0IGFzIGNvZGVjb21taXQsIGF3c19jb2RlcGlwZWxpbmUgYXMgY29kZXBpcGVsaW5lLCBhd3NfaWFtIGFzIGlhbSwgcGlwZWxpbmVzLCBhd3NfczMgYXMgczMgfSBmcm9tIFwiYXdzLWNkay1saWJcIjtcbmltcG9ydCB7IENvZGVQaXBlbGluZSB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XG5pbXBvcnQgeyBTaGVsbFN0ZXAgfSBmcm9tIFwiYXdzLWNkay1saWIvcGlwZWxpbmVzXCI7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xuaW1wb3J0IHsgRXhlY3V0ZVN0YXRlTWFjaGluZVBpcGVsaW5lIGFzIFN0YXRlTWFjaGluZVBpcGVsaW5lIH0gZnJvbSBcIi4vc3RhdGVtYWNoaW5lLXBpcGVsaW5lXCI7XG5pbXBvcnQgeyBSdWxlLCBTY2hlZHVsZSB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0IHsgQXBwQ29uZmlnIH0gZnJvbSBcIi4uLy4uL2Jpbi9hcHBcIjtcblxuZXhwb3J0IGNsYXNzIExhYmVsaW5nUGlwZWxpbmVTdGFjayBleHRlbmRzIFN0YWNrIHtcblxuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBcHBDb25maWcpIHtcbiAgICAgICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAgICAgLy9wYXNzIGluIG91ciBhcnRpZmFjdHMgYnVja2V0IGlzbnRlYWQgb2YgY3JlYXRpbmcgYSBuZXcgb25lXG4gICAgICAgIGNvbnN0IExhYmVsaW5nUGlwZWxpbmUgPSBuZXcgY29kZXBpcGVsaW5lLlBpcGVsaW5lKHRoaXMsICdMYWJlbGluZ1BpcGVsaW5lJywge1xuICAgICAgICAgICAgcGlwZWxpbmVOYW1lOiAnTWxPcHNFZGdlLUxhYmVsaW5nLUluZnJhLVBpcGVsaW5lJyxcbiAgICAgICAgICAgIGFydGlmYWN0QnVja2V0OiBzMy5CdWNrZXQuZnJvbUJ1Y2tldE5hbWUodGhpcywgXCJtbG9wcy1idWNrZXRcIiwgcHJvcHMuYXNzZXRzQnVja2V0KSxcbiAgICAgICAgICAgIHJlc3RhcnRFeGVjdXRpb25PblVwZGF0ZTogdHJ1ZVxuICAgICAgICB9KTtcblxuXG4gICAgICAgIGNvbnN0IHBpcGVsaW5lID0gbmV3IHBpcGVsaW5lcy5Db2RlUGlwZWxpbmUodGhpcywgJ2Nkay1waXBlbGluZScsIHtcbiAgICAgICAgICAgIGNvZGVQaXBlbGluZTogTGFiZWxpbmdQaXBlbGluZSxcbiAgICAgICAgICAgIGNvZGVCdWlsZERlZmF1bHRzOiB7XG4gICAgICAgICAgICAgICAgYnVpbGRFbnZpcm9ubWVudDogeyBwcml2aWxlZ2VkOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgcm9sZVBvbGljeTogW25ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICAgICAgYWN0aW9uczogWydjb2RlcGlwZWxpbmU6U3RhcnRQaXBlbGluZUV4ZWN1dGlvbiddLFxuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICAgICAgICAgIH0pXVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgc3ludGg6IG5ldyBwaXBlbGluZXMuU2hlbGxTdGVwKCdTeW50aCcsIHtcbiAgICAgICAgICAgICAgICBpbnB1dDogdGhpcy5nZXRDb2RlU291cmNlKHByb3BzKSxcbiAgICAgICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAgICAgICAnY2QgbGFiZWxpbmcnLFxuICAgICAgICAgICAgICAgICAgICAnbnBtIGNpJyxcbiAgICAgICAgICAgICAgICAgICAgJ25wbSBydW4gYnVpbGQnLFxuICAgICAgICAgICAgICAgICAgICAnbnB4IGNkayBzeW50aCcsXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBwcmltYXJ5T3V0cHV0RGlyZWN0b3J5OiBcImxhYmVsaW5nL2Nkay5vdXRcIixcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHN0YWdlID0gbmV3IERlcGxveUxhYmVsaW5nUGlwZWxpbmVTdGFnZSh0aGlzLCAnTUxPcHMtTGFiZWxpbmcnLCBwcm9wcyk7XG5cbiAgICAgICAgY29uc3QgdHJpZ2dlclN0ZXAgPSBuZXcgU2hlbGxTdGVwKCdJbnZva2VMYWJlbGluZ1BpcGVsaW5lJywge1xuICAgICAgICAgICAgZW52RnJvbUNmbk91dHB1dHM6IHtcbiAgICAgICAgICAgICAgICBQSVBFTElORV9OQU1FOiBzdGFnZS5waXBsaW5lTmFtZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICAgYGF3cyBjb2RlcGlwZWxpbmUgc3RhcnQtcGlwZWxpbmUtZXhlY3V0aW9uIC0tbmFtZSAkUElQRUxJTkVfTkFNRWBcbiAgICAgICAgICAgIF0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHBpcGVsaW5lLmFkZFN0YWdlKHN0YWdlLCB7XG4gICAgICAgICAgICBwb3N0OiBbdHJpZ2dlclN0ZXBdXG4gICAgICAgIH0pO1xuICAgICAgICAvLyBZb3UgbmVlZCB0byBjb25zdHJ1Y3QgdGhlIHBpcGVsaW5lIGJlZm9yZSBwYXNzaW5nIGl0IGFzIGEgdGFyZ2V0IGluIHJ1bGVcbiAgICAgICAgcGlwZWxpbmUuYnVpbGRQaXBlbGluZSgpXG4gICAgICAgIC8vIGNyZWF0ZSBzY2hlZHVsZWQgdHJpZ2dlciBmb3IgbGFiZWxpbmcgcGlwZWxpbmVcbiAgICAgICAgY29uc3QgcnVsZSA9IG5ldyBSdWxlKHRoaXMsICdSdWxlJywge1xuICAgICAgICAgICAgc2NoZWR1bGU6IFNjaGVkdWxlLmV4cHJlc3Npb24ocHJvcHMubGFiZWxpbmdQaXBlbGluZVNjaGVkdWxlKSxcbiAgICAgICAgfSk7XG4gICAgICAgIHJ1bGUuYWRkVGFyZ2V0KG5ldyBDb2RlUGlwZWxpbmUocGlwZWxpbmUucGlwZWxpbmUpKTtcbiAgICB9XG5cbiAgICBnZXRDb2RlU291cmNlKHByb3BzOiBBcHBDb25maWcpIHtcblxuICAgICAgICBpZiAocHJvcHMucmVwb1R5cGUgPT0gXCJDT0RFQ09NTUlUXCIgfHwgcHJvcHMucmVwb1R5cGUgPT0gXCJDT0RFQ09NTUlUX1BST1ZJREVEXCIpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlcG8gPSBjb2RlY29tbWl0LlJlcG9zaXRvcnkuZnJvbVJlcG9zaXRvcnlOYW1lKHRoaXMsICdJbXBvcnRlZFJlcG8nLCBwcm9wcy5yZXBvTmFtZSk7XG4gICAgICAgICAgICByZXR1cm4gcGlwZWxpbmVzLkNvZGVQaXBlbGluZVNvdXJjZS5jb2RlQ29tbWl0KHJlcG8sIHByb3BzLmJyYW5jaE5hbWUsIHt9KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHBpcGVsaW5lcy5Db2RlUGlwZWxpbmVTb3VyY2UuY29ubmVjdGlvbihgJHtwcm9wcy5naXRodWJSZXBvT3duZXJ9LyR7cHJvcHMucmVwb05hbWV9YCwgcHJvcHMuYnJhbmNoTmFtZSwgeyBjb25uZWN0aW9uQXJuOiBwcm9wcy5naXRodWJDb25uZWN0aW9uQXJuIH0pXG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIERlcGxveUxhYmVsaW5nUGlwZWxpbmVTdGFnZSBleHRlbmRzIFN0YWdlIHtcblxuICAgIHB1YmxpYyByZWFkb25seSBwaXBsaW5lTmFtZTogQ2ZuT3V0cHV0O1xuXG4gICAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEFwcENvbmZpZykge1xuICAgICAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgICAgICBjb25zdCBsYWJlbGluZ1BpcGVsaW5lU3RhY2sgPSBuZXcgU3RhdGVNYWNoaW5lUGlwZWxpbmUodGhpcywgJ1N0YXRlbWFjaGluZS1QaXBlbGluZS1TdGFjaycsIHtcbiAgICAgICAgICAgIC4uLnByb3BzLFxuICAgICAgICAgICAgc3RhY2tOYW1lOiBcIkxhYmVsaW5nUGlwZWxpbmVTdGFja1wiXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnBpcGxpbmVOYW1lID0gbGFiZWxpbmdQaXBlbGluZVN0YWNrLmxhYmVsaW5nUGlwZWxpbmVOYW1lO1xuXG4gICAgfVxufVxuIl19