"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GgInferenceComponentBuildConstruct = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_codebuild_1 = require("aws-cdk-lib/aws-codebuild");
const constructs_1 = require("constructs");
class GgInferenceComponentBuildConstruct extends constructs_1.Construct {
    constructor(scope, id, props) {
        var _a;
        super(scope, id);
        const ggInferenceComponentBuild = new aws_cdk_lib_1.aws_codebuild.PipelineProject(this, 'GgInferenceComponentBuild', {
            timeout: aws_cdk_lib_1.Duration.minutes(30),
            buildSpec: aws_cdk_lib_1.aws_codebuild.BuildSpec.fromObject({
                version: "0.2",
                phases: {
                    pre_build: {
                        commands: [
                            'pip3 install --upgrade awscli'
                        ]
                    },
                    build: {
                        commands: [
                            'cd inference/lib/assets/gg_components/;chmod +x buildNewInferenceComponentVersion.sh;./buildNewInferenceComponentVersion.sh',
                        ]
                    }
                },
                environment: {
                    buildImage: aws_codebuild_1.LinuxBuildImage.AMAZON_LINUX_2_3,
                    localCache: aws_codebuild_1.LocalCacheMode.DOCKER_LAYER
                }
            })
        });
        (_a = ggInferenceComponentBuild.role) === null || _a === void 0 ? void 0 : _a.addToPrincipalPolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            actions: ['s3:GetObject', 's3:PutObject', 'greengrass:ListComponents', 'greengrass:CreateComponentVersion', 'iot:DescribeThing', 'cloudformation:DescribeStacks'],
            resources: ['*'],
        }));
        this.ggInferenceComponentBuild = ggInferenceComponentBuild;
    }
}
exports.GgInferenceComponentBuildConstruct = GgInferenceComponentBuildConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2ctaW5mZXJlbmNlLWNvbXBvbmVudC1idWlsZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImdnLWluZmVyZW5jZS1jb21wb25lbnQtYnVpbGQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsNkNBS3FCO0FBQ3JCLDZEQUE0RTtBQUM1RSwyQ0FBdUM7QUFFdkMsTUFBYSxrQ0FBbUMsU0FBUSxzQkFBUztJQUc3RCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWtCOztRQUN4RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE1BQU0seUJBQXlCLEdBQUcsSUFBSSwyQkFBUyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsMkJBQTJCLEVBQUU7WUFDL0YsT0FBTyxFQUFFLHNCQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUM3QixTQUFTLEVBQUUsMkJBQVMsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDO2dCQUN0QyxPQUFPLEVBQUUsS0FBSztnQkFDZCxNQUFNLEVBQUU7b0JBQ0osU0FBUyxFQUFFO3dCQUNQLFFBQVEsRUFBRTs0QkFDTiwrQkFBK0I7eUJBQ2xDO3FCQUNKO29CQUNELEtBQUssRUFBRTt3QkFDSCxRQUFRLEVBQUU7NEJBQ04sNkhBQTZIO3lCQUNoSTtxQkFDSjtpQkFDSjtnQkFDRCxXQUFXLEVBQUU7b0JBQ1QsVUFBVSxFQUFFLCtCQUFlLENBQUMsZ0JBQWdCO29CQUM1QyxVQUFVLEVBQUUsOEJBQWMsQ0FBQyxZQUFZO2lCQUMxQzthQUNKLENBQUM7U0FDTCxDQUFDLENBQUM7UUFJSCxNQUFBLHlCQUF5QixDQUFDLElBQUksMENBQUUsb0JBQW9CLENBQUMsSUFBSSxxQkFBRyxDQUFDLGVBQWUsQ0FBQztZQUN6RSxPQUFPLEVBQUUsQ0FBQyxjQUFjLEVBQUUsY0FBYyxFQUFFLDJCQUEyQixFQUFFLG1DQUFtQyxFQUFFLG1CQUFtQixFQUFFLCtCQUErQixDQUFDO1lBQ2pLLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztTQUNuQixDQUFDLENBQUMsQ0FBQztRQUVKLElBQUksQ0FBQyx5QkFBeUIsR0FBRyx5QkFBeUIsQ0FBQTtJQUM5RCxDQUFDO0NBQ0o7QUF0Q0QsZ0ZBc0NDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgICBEdXJhdGlvbixcbiAgICBTdGFja1Byb3BzLFxuICAgIGF3c19jb2RlYnVpbGQgYXMgY29kZWJ1aWxkLFxuICAgIGF3c19pYW0gYXMgaWFtXG59IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IExpbnV4QnVpbGRJbWFnZSwgTG9jYWxDYWNoZU1vZGUgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29kZWJ1aWxkJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgY2xhc3MgR2dJbmZlcmVuY2VDb21wb25lbnRCdWlsZENvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG4gICAgcmVhZG9ubHkgZ2dJbmZlcmVuY2VDb21wb25lbnRCdWlsZDogY29kZWJ1aWxkLlBpcGVsaW5lUHJvamVjdDtcblxuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogU3RhY2tQcm9wcykge1xuICAgICAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgICAgIGNvbnN0IGdnSW5mZXJlbmNlQ29tcG9uZW50QnVpbGQgPSBuZXcgY29kZWJ1aWxkLlBpcGVsaW5lUHJvamVjdCh0aGlzLCAnR2dJbmZlcmVuY2VDb21wb25lbnRCdWlsZCcsIHtcbiAgICAgICAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLm1pbnV0ZXMoMzApLFxuICAgICAgICAgICAgYnVpbGRTcGVjOiBjb2RlYnVpbGQuQnVpbGRTcGVjLmZyb21PYmplY3Qoe1xuICAgICAgICAgICAgICAgIHZlcnNpb246IFwiMC4yXCIsXG4gICAgICAgICAgICAgICAgcGhhc2VzOiB7XG4gICAgICAgICAgICAgICAgICAgIHByZV9idWlsZDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAncGlwMyBpbnN0YWxsIC0tdXBncmFkZSBhd3NjbGknXG4gICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGJ1aWxkOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjZCBpbmZlcmVuY2UvbGliL2Fzc2V0cy9nZ19jb21wb25lbnRzLztjaG1vZCAreCBidWlsZE5ld0luZmVyZW5jZUNvbXBvbmVudFZlcnNpb24uc2g7Li9idWlsZE5ld0luZmVyZW5jZUNvbXBvbmVudFZlcnNpb24uc2gnLFxuICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgICAgICAgICBidWlsZEltYWdlOiBMaW51eEJ1aWxkSW1hZ2UuQU1BWk9OX0xJTlVYXzJfMyxcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxDYWNoZTogTG9jYWxDYWNoZU1vZGUuRE9DS0VSX0xBWUVSXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfSk7XG5cblxuXG4gICAgICAgIGdnSW5mZXJlbmNlQ29tcG9uZW50QnVpbGQucm9sZT8uYWRkVG9QcmluY2lwYWxQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgYWN0aW9uczogWydzMzpHZXRPYmplY3QnLCAnczM6UHV0T2JqZWN0JywgJ2dyZWVuZ3Jhc3M6TGlzdENvbXBvbmVudHMnLCAnZ3JlZW5ncmFzczpDcmVhdGVDb21wb25lbnRWZXJzaW9uJywgJ2lvdDpEZXNjcmliZVRoaW5nJywgJ2Nsb3VkZm9ybWF0aW9uOkRlc2NyaWJlU3RhY2tzJ10sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICB9KSk7XG5cbiAgICAgICAgdGhpcy5nZ0luZmVyZW5jZUNvbXBvbmVudEJ1aWxkID0gZ2dJbmZlcmVuY2VDb21wb25lbnRCdWlsZFxuICAgIH1cbn1cblxuIl19