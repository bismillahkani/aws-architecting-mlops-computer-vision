"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InferenceCdkPipeline = void 0;
const cdk = require("aws-cdk-lib");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const pipelines_1 = require("aws-cdk-lib/pipelines");
const inference_1 = require("./inference");
class InferenceCdkPipelineStage extends aws_cdk_lib_1.Stage {
    constructor(scope, id, props) {
        super(scope, id, props);
        const inferenceStack = new inference_1.Inference(this, 'Statemachine-Pipeline-Stack', props);
        this.pipelineName = inferenceStack.pipelineName;
    }
}
class InferenceCdkPipeline extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        //pass in our artifacts bucket instead of creating a new one
        const infra_pipeline = new aws_cdk_lib_1.aws_codepipeline.Pipeline(this, 'LabelingPipeline', {
            pipelineName: 'MlOpsEdge-Inference-Infra-Pipeline',
            artifactBucket: aws_cdk_lib_1.aws_s3.Bucket.fromBucketName(this, "mlops-bucket", props.assetsBucket),
            restartExecutionOnUpdate: true
        });
        const pipeline = new pipelines_1.CodePipeline(this, 'MlOpsEdge-Inference-Pipeline', {
            codePipeline: infra_pipeline,
            codeBuildDefaults: {
                buildEnvironment: { privileged: true },
                rolePolicy: [new aws_cdk_lib_1.aws_iam.PolicyStatement({
                        actions: ['codepipeline:StartPipelineExecution'],
                        // TODO least priviledge. Use arn of above mlOpsPipelineStage->Stack->Pipeline
                        resources: ['*'],
                    })]
            },
            synth: new pipelines_1.ShellStep('Synth', {
                input: this.getCodeSource(props),
                commands: [
                    'cd inference',
                    'npm ci',
                    'npm run build',
                    'npx cdk synth',
                ],
                primaryOutputDirectory: "inference/cdk.out",
            })
        });
        const inferenceStage = new InferenceCdkPipelineStage(this, "MLOps-Inference", props);
        const triggerStep = new pipelines_1.ShellStep('InvokeInferencePipeline', {
            envFromCfnOutputs: {
                PIPELINE_NAME: inferenceStage.pipelineName
            },
            commands: [
                `aws codepipeline start-pipeline-execution --name $PIPELINE_NAME`
            ],
        });
        pipeline.addStage(inferenceStage, {
            post: [triggerStep]
        });
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
exports.InferenceCdkPipeline = InferenceCdkPipeline;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5mZXJlbmNlLXBpcGVsaW5lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiaW5mZXJlbmNlLXBpcGVsaW5lLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQyw2Q0FBdUo7QUFDdkoscURBQW9GO0FBR3BGLDJDQUF3QztBQUV4QyxNQUFNLHlCQUEwQixTQUFRLG1CQUFLO0lBRXpDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0I7UUFDdEQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDeEIsTUFBTSxjQUFjLEdBQUcsSUFBSSxxQkFBUyxDQUFDLElBQUksRUFBRSw2QkFBNkIsRUFBRSxLQUFLLENBQUMsQ0FBQTtRQUNoRixJQUFJLENBQUMsWUFBWSxHQUFHLGNBQWMsQ0FBQyxZQUFZLENBQUE7SUFDbkQsQ0FBQztDQUNKO0FBRUQsTUFBYSxvQkFBcUIsU0FBUSxHQUFHLENBQUMsS0FBSztJQUNqRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWdCO1FBQ3hELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLDREQUE0RDtRQUM1RCxNQUFNLGNBQWMsR0FBRyxJQUFJLDhCQUFZLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMvRCxZQUFZLEVBQUUsb0NBQW9DO1lBQ2xELGNBQWMsRUFBRSxvQkFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRSxLQUFLLENBQUMsWUFBWSxDQUFDO1lBQ2xGLHdCQUF3QixFQUFFLElBQUk7U0FDL0IsQ0FBQyxDQUFDO1FBRWIsTUFBTSxRQUFRLEdBQUcsSUFBSSx3QkFBWSxDQUFDLElBQUksRUFBRSw4QkFBOEIsRUFBRTtZQUNwRSxZQUFZLEVBQUUsY0FBYztZQUU1QixpQkFBaUIsRUFBRTtnQkFDZixnQkFBZ0IsRUFBRSxFQUFDLFVBQVUsRUFBRSxJQUFJLEVBQUM7Z0JBQ3BDLFVBQVUsRUFBRSxDQUFDLElBQUkscUJBQUcsQ0FBQyxlQUFlLENBQUM7d0JBQ2pDLE9BQU8sRUFBRSxDQUFDLHFDQUFxQyxDQUFDO3dCQUNoRCw4RUFBOEU7d0JBQzlFLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztxQkFDbkIsQ0FBQyxDQUFDO2FBQ047WUFDRCxLQUFLLEVBQUUsSUFBSSxxQkFBUyxDQUFDLE9BQU8sRUFBRTtnQkFDMUIsS0FBSyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDO2dCQUNoQyxRQUFRLEVBQUU7b0JBQ04sY0FBYztvQkFDZCxRQUFRO29CQUNSLGVBQWU7b0JBQ2YsZUFBZTtpQkFDbEI7Z0JBQ0Qsc0JBQXNCLEVBQUUsbUJBQW1CO2FBQzlDLENBQUM7U0FDTCxDQUFDLENBQUM7UUFFSCxNQUFNLGNBQWMsR0FBRyxJQUFJLHlCQUF5QixDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRSxLQUFLLENBQUMsQ0FBQTtRQUVwRixNQUFNLFdBQVcsR0FBRyxJQUFJLHFCQUFTLENBQUMseUJBQXlCLEVBQUU7WUFDekQsaUJBQWlCLEVBQUU7Z0JBQ2YsYUFBYSxFQUFFLGNBQWMsQ0FBQyxZQUFZO2FBQzdDO1lBQ0QsUUFBUSxFQUFFO2dCQUNOLGlFQUFpRTthQUNwRTtTQUNKLENBQUMsQ0FBQztRQUdILFFBQVEsQ0FBQyxRQUFRLENBQUMsY0FBYyxFQUFFO1lBQzlCLElBQUksRUFBRSxDQUFDLFdBQVcsQ0FBQztTQUN0QixDQUFDLENBQUM7SUFFTCxDQUFDO0lBQ0QsYUFBYSxDQUFDLEtBQWdCO1FBRTVCLElBQUksS0FBSyxDQUFDLFFBQVEsSUFBSSxZQUFZLElBQUksS0FBSyxDQUFDLFFBQVEsSUFBSSxxQkFBcUIsRUFBRTtZQUMzRSxNQUFNLElBQUksR0FBRyw0QkFBVSxDQUFDLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM1RixPQUFPLHVCQUFTLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxDQUFBO1NBQzdFO2FBQUk7WUFDRCxPQUFPLHVCQUFTLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLEdBQUcsS0FBSyxDQUFDLGVBQWUsSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUMsS0FBSyxDQUFDLFVBQVUsRUFBQyxFQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsbUJBQW1CLEVBQUMsQ0FBQyxDQUFBO1NBQzNKO0lBQ0wsQ0FBQztDQUVBO0FBN0RELG9EQTZEQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBhd3NfY29kZWNvbW1pdCBhcyBjb2RlY29tbWl0LCBhd3NfY29kZXBpcGVsaW5lIGFzIGNvZGVwaXBlbGluZSwgYXdzX2lhbSBhcyBpYW0sIGF3c19zMyBhcyBzMywgcGlwZWxpbmVzLENmbk91dHB1dCwgU3RhZ2UgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb2RlUGlwZWxpbmUsIENvZGVQaXBlbGluZVNvdXJjZSwgU2hlbGxTdGVwIH0gZnJvbSAnYXdzLWNkay1saWIvcGlwZWxpbmVzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgQXBwQ29uZmlnIH0gZnJvbSAnLi4vLi4vYmluL2FwcCc7XG5pbXBvcnQgeyBJbmZlcmVuY2UgfSBmcm9tICcuL2luZmVyZW5jZSc7XG5cbmNsYXNzIEluZmVyZW5jZUNka1BpcGVsaW5lU3RhZ2UgZXh0ZW5kcyBTdGFnZSB7XG4gICAgcmVhZG9ubHkgcGlwZWxpbmVOYW1lIDogQ2ZuT3V0cHV0O1xuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBcHBDb25maWcpIHtcbiAgICAgICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG4gICAgICAgIGNvbnN0IGluZmVyZW5jZVN0YWNrID0gbmV3IEluZmVyZW5jZSh0aGlzLCAnU3RhdGVtYWNoaW5lLVBpcGVsaW5lLVN0YWNrJywgcHJvcHMpXG4gICAgICAgIHRoaXMucGlwZWxpbmVOYW1lID0gaW5mZXJlbmNlU3RhY2sucGlwZWxpbmVOYW1lXG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgSW5mZXJlbmNlQ2RrUGlwZWxpbmUgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQXBwQ29uZmlnKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvL3Bhc3MgaW4gb3VyIGFydGlmYWN0cyBidWNrZXQgaW5zdGVhZCBvZiBjcmVhdGluZyBhIG5ldyBvbmVcbiAgICBjb25zdCBpbmZyYV9waXBlbGluZSA9IG5ldyBjb2RlcGlwZWxpbmUuUGlwZWxpbmUodGhpcywgJ0xhYmVsaW5nUGlwZWxpbmUnLCB7XG4gICAgICAgICAgICAgICAgcGlwZWxpbmVOYW1lOiAnTWxPcHNFZGdlLUluZmVyZW5jZS1JbmZyYS1QaXBlbGluZScsXG4gICAgICAgICAgICAgICAgYXJ0aWZhY3RCdWNrZXQ6IHMzLkJ1Y2tldC5mcm9tQnVja2V0TmFtZSh0aGlzLCBcIm1sb3BzLWJ1Y2tldFwiLCBwcm9wcy5hc3NldHNCdWNrZXQpLFxuICAgICAgICAgICAgICAgIHJlc3RhcnRFeGVjdXRpb25PblVwZGF0ZTogdHJ1ZVxuICAgICAgICAgICAgICB9KTtcblxuICAgIGNvbnN0IHBpcGVsaW5lID0gbmV3IENvZGVQaXBlbGluZSh0aGlzLCAnTWxPcHNFZGdlLUluZmVyZW5jZS1QaXBlbGluZScsIHtcbiAgICAgICAgY29kZVBpcGVsaW5lOiBpbmZyYV9waXBlbGluZSxcblxuICAgICAgICBjb2RlQnVpbGREZWZhdWx0czoge1xuICAgICAgICAgICAgYnVpbGRFbnZpcm9ubWVudDoge3ByaXZpbGVnZWQ6IHRydWV9LFxuICAgICAgICAgICAgcm9sZVBvbGljeTogW25ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICBhY3Rpb25zOiBbJ2NvZGVwaXBlbGluZTpTdGFydFBpcGVsaW5lRXhlY3V0aW9uJ10sXG4gICAgICAgICAgICAgICAgLy8gVE9ETyBsZWFzdCBwcml2aWxlZGdlLiBVc2UgYXJuIG9mIGFib3ZlIG1sT3BzUGlwZWxpbmVTdGFnZS0+U3RhY2stPlBpcGVsaW5lXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgICAgICAgIH0pXVxuICAgICAgICB9LFxuICAgICAgICBzeW50aDogbmV3IFNoZWxsU3RlcCgnU3ludGgnLCB7XG4gICAgICAgICAgICBpbnB1dDogdGhpcy5nZXRDb2RlU291cmNlKHByb3BzKSxcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICAgJ2NkIGluZmVyZW5jZScsXG4gICAgICAgICAgICAgICAgJ25wbSBjaScsXG4gICAgICAgICAgICAgICAgJ25wbSBydW4gYnVpbGQnLFxuICAgICAgICAgICAgICAgICducHggY2RrIHN5bnRoJyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBwcmltYXJ5T3V0cHV0RGlyZWN0b3J5OiBcImluZmVyZW5jZS9jZGsub3V0XCIsXG4gICAgICAgIH0pXG4gICAgfSk7XG5cbiAgICBjb25zdCBpbmZlcmVuY2VTdGFnZSA9IG5ldyBJbmZlcmVuY2VDZGtQaXBlbGluZVN0YWdlKHRoaXMsIFwiTUxPcHMtSW5mZXJlbmNlXCIsIHByb3BzKVxuICAgIFxuICAgIGNvbnN0IHRyaWdnZXJTdGVwID0gbmV3IFNoZWxsU3RlcCgnSW52b2tlSW5mZXJlbmNlUGlwZWxpbmUnLCB7XG4gICAgICAgIGVudkZyb21DZm5PdXRwdXRzOiB7XG4gICAgICAgICAgICBQSVBFTElORV9OQU1FOiBpbmZlcmVuY2VTdGFnZS5waXBlbGluZU5hbWVcbiAgICAgICAgfSxcbiAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgIGBhd3MgY29kZXBpcGVsaW5lIHN0YXJ0LXBpcGVsaW5lLWV4ZWN1dGlvbiAtLW5hbWUgJFBJUEVMSU5FX05BTUVgXG4gICAgICAgIF0sXG4gICAgfSk7XG5cblxuICAgIHBpcGVsaW5lLmFkZFN0YWdlKGluZmVyZW5jZVN0YWdlLCB7XG4gICAgICAgIHBvc3Q6IFt0cmlnZ2VyU3RlcF1cbiAgICB9KTtcbiAgICBcbiAgfVxuICBnZXRDb2RlU291cmNlKHByb3BzOiBBcHBDb25maWcpIHtcblxuICAgIGlmIChwcm9wcy5yZXBvVHlwZSA9PSBcIkNPREVDT01NSVRcIiB8fCBwcm9wcy5yZXBvVHlwZSA9PSBcIkNPREVDT01NSVRfUFJPVklERURcIikge1xuICAgICAgICBjb25zdCByZXBvID0gY29kZWNvbW1pdC5SZXBvc2l0b3J5LmZyb21SZXBvc2l0b3J5TmFtZSh0aGlzLCAnSW1wb3J0ZWRSZXBvJywgcHJvcHMucmVwb05hbWUpO1xuICAgICAgICByZXR1cm4gcGlwZWxpbmVzLkNvZGVQaXBlbGluZVNvdXJjZS5jb2RlQ29tbWl0KHJlcG8sIHByb3BzLmJyYW5jaE5hbWUsIHt9KVxuICAgIH1lbHNle1xuICAgICAgICByZXR1cm4gcGlwZWxpbmVzLkNvZGVQaXBlbGluZVNvdXJjZS5jb25uZWN0aW9uKGAke3Byb3BzLmdpdGh1YlJlcG9Pd25lcn0vJHtwcm9wcy5yZXBvTmFtZX1gLHByb3BzLmJyYW5jaE5hbWUse2Nvbm5lY3Rpb25Bcm46IHByb3BzLmdpdGh1YkNvbm5lY3Rpb25Bcm59KVxuICAgIH1cbn1cbiAgXG59XG4iXX0=