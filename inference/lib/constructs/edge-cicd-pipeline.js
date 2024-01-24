"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EdgeCiCdPipelineConstruct = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_codepipeline_actions_1 = require("aws-cdk-lib/aws-codepipeline-actions");
const constructs_1 = require("constructs");
const edge_deployment_orchestration_1 = require("./edge-deployment-orchestration");
class EdgeCiCdPipelineConstruct extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const sourceOutput = new aws_cdk_lib_1.aws_codepipeline.Artifact();
        const deployGreengrassComponentPipelineTrigger = new aws_cdk_lib_1.aws_codepipeline_actions.CodeBuildAction({
            actionName: 'CodeBuild',
            project: props.ggInferenceComponentBuild,
            input: sourceOutput,
            environmentVariables: {
                IOT_THING_NAME: { value: props.iotThingName },
                ARTIFACT_BUCKET: { value: props.assetsBucket }
            }
        });
        const pipeline = new aws_cdk_lib_1.aws_codepipeline.Pipeline(this, 'InferenceCiCdPipeline', {
            pipelineName: 'MlOpsEdge-Inference-Pipeline',
            artifactBucket: aws_cdk_lib_1.aws_s3.Bucket.fromBucketName(this, "artifactsbucket", props.assetsBucket),
            stages: [
                {
                    stageName: 'Source',
                    actions: [this.getCodeSource(props, sourceOutput)],
                },
                {
                    stageName: 'CreateNewInferenceComponentVersion',
                    actions: [deployGreengrassComponentPipelineTrigger],
                },
                {
                    stageName: 'PackageAndDeployComponentsToEdgeDevice',
                    actions: [props.edgeDeploymentStepFunction],
                },
            ],
        });
        this.pipelineName = new aws_cdk_lib_1.CfnOutput(this, 'EdgeCiCdPipelineNameExport', {
            value: pipeline.pipelineName
        });
        const rule = new aws_cdk_lib_1.aws_events.Rule(this, 'InferenceTriggerOnNewModel', {
            eventPattern: {
                detailType: ["SageMaker Model Package State Change"],
                source: ["aws.sagemaker"],
                detail: {
                    "ModelPackageGroupName": [edge_deployment_orchestration_1.EdgeDeploymentOrchestrationConstruct.MODEL_PACKAGE_GROUP_NAME],
                    "ModelApprovalStatus": ["Approved"],
                }
            }
        });
        rule.addTarget(new aws_cdk_lib_1.aws_events_targets.CodePipeline(pipeline));
    }
    getCodeSource(props, sourceOutput) {
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
                // not triggering ad the pipeline will be triggered by infrastructure pipeline anyways
                triggerOnPush: false,
                connectionArn: props.githubConnectionArn
            });
        }
    }
}
exports.EdgeCiCdPipelineConstruct = EdgeCiCdPipelineConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRnZS1jaWNkLXBpcGVsaW5lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZWRnZS1jaWNkLXBpcGVsaW5lLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZDQUVxQjtBQUVyQixtRkFBdUU7QUFDdkUsMkNBQXVDO0FBRXZDLG1GQUFxRjtBQVFyRixNQUFhLHlCQUEwQixTQUFRLHNCQUFTO0lBR3BELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBcUM7UUFDM0UsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixNQUFNLFlBQVksR0FBRyxJQUFJLDhCQUFZLENBQUMsUUFBUSxFQUFFLENBQUM7UUFFakQsTUFBTSx3Q0FBd0MsR0FBRyxJQUFJLHNDQUFvQixDQUFDLGVBQWUsQ0FBQztZQUN0RixVQUFVLEVBQUUsV0FBVztZQUN2QixPQUFPLEVBQUUsS0FBSyxDQUFDLHlCQUF5QjtZQUN4QyxLQUFLLEVBQUUsWUFBWTtZQUNuQixvQkFBb0IsRUFBRTtnQkFDbEIsY0FBYyxFQUFFLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxZQUFZLEVBQUU7Z0JBQzdDLGVBQWUsRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsWUFBWSxFQUFFO2FBQ2pEO1NBQ0osQ0FBQyxDQUFDO1FBRUgsTUFBTSxRQUFRLEdBQUksSUFBSSw4QkFBWSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDdkUsWUFBWSxFQUFFLDhCQUE4QjtZQUM1QyxjQUFjLEVBQUUsb0JBQUUsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRSxLQUFLLENBQUMsWUFBWSxDQUFDO1lBQ3JGLE1BQU0sRUFBRTtnQkFDSjtvQkFDSSxTQUFTLEVBQUUsUUFBUTtvQkFDbkIsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUMsWUFBWSxDQUFDLENBQUM7aUJBQ3BEO2dCQUNEO29CQUNJLFNBQVMsRUFBRSxvQ0FBb0M7b0JBQy9DLE9BQU8sRUFBRSxDQUFDLHdDQUF3QyxDQUFDO2lCQUN0RDtnQkFDRDtvQkFDSSxTQUFTLEVBQUUsd0NBQXdDO29CQUNuRCxPQUFPLEVBQUUsQ0FBQyxLQUFLLENBQUMsMEJBQTBCLENBQUM7aUJBQzlDO2FBQ0o7U0FDSixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksdUJBQVMsQ0FBQyxJQUFJLEVBQUUsNEJBQTRCLEVBQUU7WUFDbEUsS0FBSyxFQUFFLFFBQVEsQ0FBQyxZQUFZO1NBQy9CLENBQUMsQ0FBQztRQUVILE1BQU0sSUFBSSxHQUFHLElBQUksd0JBQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLDRCQUE0QixFQUFFO1lBQzdELFlBQVksRUFBRTtnQkFDVixVQUFVLEVBQUUsQ0FBQyxzQ0FBc0MsQ0FBQztnQkFDcEQsTUFBTSxFQUFFLENBQUMsZUFBZSxDQUFDO2dCQUN6QixNQUFNLEVBQUU7b0JBQ0osdUJBQXVCLEVBQUUsQ0FBQyxvRUFBb0MsQ0FBQyx3QkFBd0IsQ0FBQztvQkFDeEYscUJBQXFCLEVBQUUsQ0FBQyxVQUFVLENBQUM7aUJBQ3RDO2FBQ0o7U0FDSixDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksZ0NBQU8sQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQTtJQUd0RCxDQUFDO0lBRUQsYUFBYSxDQUFDLEtBQWdCLEVBQUUsWUFBbUM7UUFDL0QsSUFBSSxLQUFLLENBQUMsUUFBUSxJQUFJLFlBQVksSUFBSSxLQUFLLENBQUMsUUFBUSxJQUFJLHFCQUFxQixFQUFFO1lBQzFFLE1BQU0sVUFBVSxHQUFHLDRCQUFVLENBQUMsVUFBVSxDQUFDLGtCQUFrQixDQUFDLElBQUksRUFBRSxZQUFZLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFBO1lBQy9GLE9BQU8sSUFBSSxzQ0FBb0IsQ0FBQyxzQkFBc0IsQ0FBQztnQkFDbkQsVUFBVSxFQUFFLFlBQVk7Z0JBQ3hCLFVBQVU7Z0JBQ1YsTUFBTSxFQUFFLEtBQUssQ0FBQyxVQUFVO2dCQUN4QixNQUFNLEVBQUUsWUFBWTtnQkFDcEIsT0FBTyxFQUFFLDRDQUFpQixDQUFDLElBQUk7YUFDbEMsQ0FBQyxDQUFDO1NBQ047YUFBTTtZQUNILE9BQU8sSUFBSSxzQ0FBb0IsQ0FBQywrQkFBK0IsQ0FBQztnQkFDNUQsVUFBVSxFQUFFLEdBQUcsS0FBSyxDQUFDLGVBQWUsSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFO2dCQUN4RCxNQUFNLEVBQUUsS0FBSyxDQUFDLFVBQVU7Z0JBQ3hCLE1BQU0sRUFBRSxZQUFZO2dCQUNwQixLQUFLLEVBQUUsS0FBSyxDQUFDLGVBQWU7Z0JBQzVCLElBQUksRUFBRSxLQUFLLENBQUMsUUFBUTtnQkFDcEIsc0ZBQXNGO2dCQUN0RixhQUFhLEVBQUUsS0FBSztnQkFDcEIsYUFBYSxFQUFFLEtBQUssQ0FBQyxtQkFBbUI7YUFFM0MsQ0FBQyxDQUFDO1NBQ047SUFDTCxDQUFDO0NBQ0w7QUFoRkQsOERBZ0ZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgICBhd3NfY29kZWJ1aWxkIGFzIGNvZGVidWlsZCwgYXdzX3MzIGFzIHMzLGF3c19jb2RlY29tbWl0IGFzIGNvZGVjb21taXQsIGF3c19jb2RlcGlwZWxpbmUgYXMgY29kZXBpcGVsaW5lLCBhd3NfY29kZXBpcGVsaW5lX2FjdGlvbnMgYXMgY29kZXBpcGVsaW5lX2FjdGlvbnMsIGF3c19ldmVudHMgYXMgZXZlbnRzLCBhd3NfZXZlbnRzX3RhcmdldHMgYXMgdGFyZ2V0cywgQ2ZuT3V0cHV0XG59IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IFN0ZXBGdW5jdGlvbkludm9rZUFjdGlvbiB9IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtY29kZXBpcGVsaW5lLWFjdGlvbnNcIjtcbmltcG9ydCB7Q29kZUNvbW1pdFRyaWdnZXJ9IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtY29kZXBpcGVsaW5lLWFjdGlvbnNcIjtcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgQXBwQ29uZmlnIH0gZnJvbSAnLi4vLi4vYmluL2FwcCdcbmltcG9ydCB7RWRnZURlcGxveW1lbnRPcmNoZXN0cmF0aW9uQ29uc3RydWN0fSBmcm9tIFwiLi9lZGdlLWRlcGxveW1lbnQtb3JjaGVzdHJhdGlvblwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIEVkZ2VDaUNkUGlwZWxpbmVDb25zdHJ1Y3RQcm9wcyBleHRlbmRzIEFwcENvbmZpZ3tcbiAgICBpb3RUaGluZ05hbWU6IHN0cmluZyxcbiAgICBnZ0luZmVyZW5jZUNvbXBvbmVudEJ1aWxkOiBjb2RlYnVpbGQuUGlwZWxpbmVQcm9qZWN0XG4gICAgZWRnZURlcGxveW1lbnRTdGVwRnVuY3Rpb246IFN0ZXBGdW5jdGlvbkludm9rZUFjdGlvblxufVxuXG5leHBvcnQgY2xhc3MgRWRnZUNpQ2RQaXBlbGluZUNvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG4gICAgcHVibGljIHJlYWRvbmx5IHBpcGVsaW5lTmFtZTogQ2ZuT3V0cHV0O1xuXG4gICAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEVkZ2VDaUNkUGlwZWxpbmVDb25zdHJ1Y3RQcm9wcykge1xuICAgICAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgICAgIGNvbnN0IHNvdXJjZU91dHB1dCA9IG5ldyBjb2RlcGlwZWxpbmUuQXJ0aWZhY3QoKTtcblxuICAgICAgICBjb25zdCBkZXBsb3lHcmVlbmdyYXNzQ29tcG9uZW50UGlwZWxpbmVUcmlnZ2VyID0gbmV3IGNvZGVwaXBlbGluZV9hY3Rpb25zLkNvZGVCdWlsZEFjdGlvbih7XG4gICAgICAgICAgICBhY3Rpb25OYW1lOiAnQ29kZUJ1aWxkJyxcbiAgICAgICAgICAgIHByb2plY3Q6IHByb3BzLmdnSW5mZXJlbmNlQ29tcG9uZW50QnVpbGQsXG4gICAgICAgICAgICBpbnB1dDogc291cmNlT3V0cHV0LFxuICAgICAgICAgICAgZW52aXJvbm1lbnRWYXJpYWJsZXM6IHtcbiAgICAgICAgICAgICAgICBJT1RfVEhJTkdfTkFNRTogeyB2YWx1ZTogcHJvcHMuaW90VGhpbmdOYW1lIH0sXG4gICAgICAgICAgICAgICAgQVJUSUZBQ1RfQlVDS0VUOiB7IHZhbHVlOiBwcm9wcy5hc3NldHNCdWNrZXQgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBwaXBlbGluZSA9ICBuZXcgY29kZXBpcGVsaW5lLlBpcGVsaW5lKHRoaXMsICdJbmZlcmVuY2VDaUNkUGlwZWxpbmUnLCB7XG4gICAgICAgICAgICBwaXBlbGluZU5hbWU6ICdNbE9wc0VkZ2UtSW5mZXJlbmNlLVBpcGVsaW5lJyxcbiAgICAgICAgICAgIGFydGlmYWN0QnVja2V0OiBzMy5CdWNrZXQuZnJvbUJ1Y2tldE5hbWUodGhpcywgXCJhcnRpZmFjdHNidWNrZXRcIiwgcHJvcHMuYXNzZXRzQnVja2V0KSxcbiAgICAgICAgICAgIHN0YWdlczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhZ2VOYW1lOiAnU291cmNlJyxcbiAgICAgICAgICAgICAgICAgICAgYWN0aW9uczogW3RoaXMuZ2V0Q29kZVNvdXJjZShwcm9wcyxzb3VyY2VPdXRwdXQpXSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhZ2VOYW1lOiAnQ3JlYXRlTmV3SW5mZXJlbmNlQ29tcG9uZW50VmVyc2lvbicsXG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbnM6IFtkZXBsb3lHcmVlbmdyYXNzQ29tcG9uZW50UGlwZWxpbmVUcmlnZ2VyXSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhZ2VOYW1lOiAnUGFja2FnZUFuZERlcGxveUNvbXBvbmVudHNUb0VkZ2VEZXZpY2UnLFxuICAgICAgICAgICAgICAgICAgICBhY3Rpb25zOiBbcHJvcHMuZWRnZURlcGxveW1lbnRTdGVwRnVuY3Rpb25dLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLnBpcGVsaW5lTmFtZSA9IG5ldyBDZm5PdXRwdXQodGhpcywgJ0VkZ2VDaUNkUGlwZWxpbmVOYW1lRXhwb3J0Jywge1xuICAgICAgICAgICAgdmFsdWU6IHBpcGVsaW5lLnBpcGVsaW5lTmFtZVxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBydWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdJbmZlcmVuY2VUcmlnZ2VyT25OZXdNb2RlbCcsIHtcbiAgICAgICAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICAgICAgICAgIGRldGFpbFR5cGU6IFtcIlNhZ2VNYWtlciBNb2RlbCBQYWNrYWdlIFN0YXRlIENoYW5nZVwiXSxcbiAgICAgICAgICAgICAgICBzb3VyY2U6IFtcImF3cy5zYWdlbWFrZXJcIl0sXG4gICAgICAgICAgICAgICAgZGV0YWlsOiB7XG4gICAgICAgICAgICAgICAgICAgIFwiTW9kZWxQYWNrYWdlR3JvdXBOYW1lXCI6IFtFZGdlRGVwbG95bWVudE9yY2hlc3RyYXRpb25Db25zdHJ1Y3QuTU9ERUxfUEFDS0FHRV9HUk9VUF9OQU1FXSxcbiAgICAgICAgICAgICAgICAgICAgXCJNb2RlbEFwcHJvdmFsU3RhdHVzXCI6IFtcIkFwcHJvdmVkXCJdLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJ1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLkNvZGVQaXBlbGluZShwaXBlbGluZSkpXG5cblxuICAgIH1cblxuICAgIGdldENvZGVTb3VyY2UocHJvcHM6IEFwcENvbmZpZywgc291cmNlT3V0cHV0OiBjb2RlcGlwZWxpbmUuQXJ0aWZhY3QpIHtcbiAgICAgICAgaWYgKHByb3BzLnJlcG9UeXBlID09IFwiQ09ERUNPTU1JVFwiIHx8IHByb3BzLnJlcG9UeXBlID09IFwiQ09ERUNPTU1JVF9QUk9WSURFRFwiKSB7XG4gICAgICAgICAgICAgY29uc3QgcmVwb3NpdG9yeSA9IGNvZGVjb21taXQuUmVwb3NpdG9yeS5mcm9tUmVwb3NpdG9yeU5hbWUodGhpcywgJ3JlcG9zaXRvcnknLCBwcm9wcy5yZXBvTmFtZSlcbiAgICAgICAgICAgICByZXR1cm4gbmV3IGNvZGVwaXBlbGluZV9hY3Rpb25zLkNvZGVDb21taXRTb3VyY2VBY3Rpb24oe1xuICAgICAgICAgICAgICAgICBhY3Rpb25OYW1lOiAnQ29kZUNvbW1pdCcsXG4gICAgICAgICAgICAgICAgIHJlcG9zaXRvcnksXG4gICAgICAgICAgICAgICAgIGJyYW5jaDogcHJvcHMuYnJhbmNoTmFtZSxcbiAgICAgICAgICAgICAgICAgb3V0cHV0OiBzb3VyY2VPdXRwdXQsXG4gICAgICAgICAgICAgICAgIHRyaWdnZXI6IENvZGVDb21taXRUcmlnZ2VyLk5PTkUsXG4gICAgICAgICAgICAgfSk7XG4gICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgIHJldHVybiBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuQ29kZVN0YXJDb25uZWN0aW9uc1NvdXJjZUFjdGlvbih7XG4gICAgICAgICAgICAgICAgIGFjdGlvbk5hbWU6IGAke3Byb3BzLmdpdGh1YlJlcG9Pd25lcn1fJHtwcm9wcy5yZXBvTmFtZX1gLFxuICAgICAgICAgICAgICAgICBicmFuY2g6IHByb3BzLmJyYW5jaE5hbWUsXG4gICAgICAgICAgICAgICAgIG91dHB1dDogc291cmNlT3V0cHV0LFxuICAgICAgICAgICAgICAgICBvd25lcjogcHJvcHMuZ2l0aHViUmVwb093bmVyLFxuICAgICAgICAgICAgICAgICByZXBvOiBwcm9wcy5yZXBvTmFtZSxcbiAgICAgICAgICAgICAgICAgLy8gbm90IHRyaWdnZXJpbmcgYWQgdGhlIHBpcGVsaW5lIHdpbGwgYmUgdHJpZ2dlcmVkIGJ5IGluZnJhc3RydWN0dXJlIHBpcGVsaW5lIGFueXdheXNcbiAgICAgICAgICAgICAgICAgdHJpZ2dlck9uUHVzaDogZmFsc2UsXG4gICAgICAgICAgICAgICAgIGNvbm5lY3Rpb25Bcm46IHByb3BzLmdpdGh1YkNvbm5lY3Rpb25Bcm5cblxuICAgICAgICAgICAgIH0pO1xuICAgICAgICAgfVxuICAgICB9XG59XG4iXX0=