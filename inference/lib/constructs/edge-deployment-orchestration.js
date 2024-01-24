"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EdgeDeploymentOrchestrationConstruct = void 0;
const lambda_python = require("@aws-cdk/aws-lambda-python-alpha");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_codepipeline_actions_1 = require("aws-cdk-lib/aws-codepipeline-actions");
const aws_stepfunctions_1 = require("aws-cdk-lib/aws-stepfunctions");
const constructs_1 = require("constructs");
const path = require("path");
class EdgeDeploymentOrchestrationConstruct extends constructs_1.Construct {
    constructor(scope, id, props) {
        var _a;
        super(scope, id);
        this.stepFunctionName = `EdgeDeploymentOrchestration-${aws_cdk_lib_1.Stack.of(this).stackName}`;
        const stepFunctionRole = new aws_cdk_lib_1.aws_iam.Role(this, 'edge-packaging-sfn-exec-role', {
            assumedBy: new aws_cdk_lib_1.aws_iam.ServicePrincipal('states.amazonaws.com'),
            managedPolicies: [
                aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
                aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
                aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AWSLambda_FullAccess'),
                aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AWSGreengrassFullAccess'),
                aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AWSIoTFullAccess'),
                aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccess')
            ],
        });
        (_a = stepFunctionRole.assumeRolePolicy) === null || _a === void 0 ? void 0 : _a.addStatements(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            actions: ['sts:AssumeRole'],
            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
            principals: [
                new aws_cdk_lib_1.aws_iam.ServicePrincipal('sagemaker.amazonaws.com'),
            ],
        }));
        const lambdaRole = new aws_cdk_lib_1.aws_iam.Role(this, 'edge-packaging-lambda-exec-role', {
            assumedBy: new aws_cdk_lib_1.aws_iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AWSGreengrassReadOnlyAccess'),
                aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMFullAccess'),
                aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess')
            ]
        });
        const findLatestComponentVersionFunction = new lambda_python.PythonFunction(this, 'LatestComponentVersion', {
            entry: path.join('lib', 'assets', 'gg_component_version_helper'),
            index: 'setup.py',
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.PYTHON_3_11,
            logRetention: aws_cdk_lib_1.aws_logs.RetentionDays.ONE_DAY,
            role: lambdaRole,
            timeout: aws_cdk_lib_1.Duration.seconds(15),
            environment: {
                'SAGEMAKER_ROLE_ARN': stepFunctionRole.roleArn
            }
        });
        const findModelBlobURL = new lambda_python.PythonFunction(this, 'ModelBlobURL', {
            entry: path.join('lib', 'assets', 'model_version_helper'),
            index: 'setup.py',
            runtime: aws_cdk_lib_1.aws_lambda.Runtime.PYTHON_3_11,
            logRetention: aws_cdk_lib_1.aws_logs.RetentionDays.ONE_DAY,
            role: lambdaRole,
            timeout: aws_cdk_lib_1.Duration.seconds(15),
        });
        asl.States['Get model blob url'].Parameters.FunctionName = findModelBlobURL.functionArn;
        asl.States['Get next Greengrass model component version'].Parameters.FunctionName = findLatestComponentVersionFunction.functionArn;
        asl.States['Get next Greengrass model component version'].Parameters.Payload.ComponentName = props.deploymentProps.ggModelComponentName;
        asl.States['Get inference component version'].Parameters.FunctionName = findLatestComponentVersionFunction.functionArn;
        asl.States['Get inference component version'].Parameters.Payload.ComponentName = props.deploymentProps.ggInferenceComponentName;
        asl.States['Get IoT Thing ARN'].Parameters.ThingName = props.iotThingName;
        const packageModelWorkflow = new aws_cdk_lib_1.aws_stepfunctions.CfnStateMachine(this, 'EdgeDeploymentOrchestrationStepFunction', {
            roleArn: stepFunctionRole.roleArn,
            definitionString: JSON.stringify(asl),
            stateMachineName: this.stepFunctionName
        });
        const stepFunctionInput = {
            "ModelPackageGroupName": props.deploymentProps.smModelPackageGroupName,
            "invokationSource": "CodeBuild",
            "modelArn": ""
        };
        this.stepFunctionArn = `arn:aws:states:${aws_cdk_lib_1.Stack.of(this).region}:${aws_cdk_lib_1.Stack.of(this).account}:stateMachine:${this.stepFunctionName}`;
        this.stepFunctionAction = new aws_codepipeline_actions_1.StepFunctionInvokeAction({
            actionName: 'Invoke',
            stateMachine: aws_stepfunctions_1.StateMachine.fromStateMachineArn(this, 'state-machine-from-arn', this.stepFunctionArn),
            stateMachineInput: aws_codepipeline_actions_1.StateMachineInput.literal(stepFunctionInput)
        });
    }
}
exports.EdgeDeploymentOrchestrationConstruct = EdgeDeploymentOrchestrationConstruct;
EdgeDeploymentOrchestrationConstruct.MODEL_PACKAGE_GROUP_NAME = 'TagQualityInspectionPackageGroup';
// TODO:  Add native CDK definition
const asl = {
    "StartAt": "Get model blob url",
    "States": {
        "Get model blob url": {
            "Type": "Task",
            "Next": "Get next Greengrass model component version",
            "Resource": "arn:aws:states:::lambda:invoke",
            "Parameters": {
                "FunctionName": "",
                "Payload.$": "$"
            },
            "Retry": [
                {
                    "ErrorEquals": [
                        "Lambda.ServiceException",
                        "Lambda.AWSLambdaException",
                        "Lambda.SdkClientException",
                        "Lambda.TooManyRequestsException"
                    ],
                    "IntervalSeconds": 1,
                    "MaxAttempts": 3,
                    "BackoffRate": 2
                }
            ],
            "ResultSelector": {
                "value.$": "$.Payload.ModelUrl"
            },
            "ResultPath": "$.ModelUrl",
        },
        "Get next Greengrass model component version": {
            "Type": "Task",
            "Next": "Create new Greengrass model component",
            "Resource": "arn:aws:states:::lambda:invoke",
            "Parameters": {
                "FunctionName": "",
                "Payload": {
                    "ComponentName": "com.qualityinspection.model"
                }
            },
            "Retry": [
                {
                    "ErrorEquals": [
                        "Lambda.ServiceException",
                        "Lambda.AWSLambdaException",
                        "Lambda.SdkClientException"
                    ],
                    "IntervalSeconds": 2,
                    "MaxAttempts": 6,
                    "BackoffRate": 2
                }
            ],
            "ResultSelector": {
                "value.$": "$.Payload.NextVersion"
            },
            "ResultPath": "$.ModelNextVersion"
        },
        "Create new Greengrass model component": {
            "Type": "Task",
            "Next": "Get IoT Thing ARN",
            "Parameters": {
                "InlineRecipe": {
                    "RecipeFormatVersion": "2020-01-25",
                    "ComponentName": "com.qualityinspection.model",
                    "ComponentVersion.$": "$.ModelNextVersion.value",
                    "ComponentPublisher": "AWS",
                    "Manifests": [
                        {
                            "Platform": {
                                "os": "*",
                                "architecture": "*"
                            },
                            "Lifecycle": {
                                "Install": {
                                    "Script": "tar xzf {artifacts:path}/model.tar.gz -C {artifacts:decompressedPath}",
                                    "RequiresPrivilege": true
                                },
                                "Upgrade": {
                                    "Script": "tar xzf {artifacts:path}/model.tar.gz -C {artifacts:decompressedPath}",
                                    "RequiresPrivilege": true
                                },
                                "Uninstall": {
                                    "Script": "rm -rf {artifacts:decompressedPath} {artifacts:path}",
                                    "RequiresPrivilege": true
                                }
                            },
                            "Artifacts": [
                                {
                                    "Uri.$": "$.ModelUrl.value",
                                    "Permission": {
                                        "Read": "OWNER",
                                        "Execute": "NONE"
                                    }
                                }
                            ]
                        }
                    ]
                }
            },
            "Resource": "arn:aws:states:::aws-sdk:greengrassv2:createComponentVersion",
            "ResultPath": null
        },
        "Get IoT Thing ARN": {
            "Type": "Task",
            "Next": "Get inference component version",
            "Parameters": {
                "ThingName": "EdgeThing-MLOps-Inference-Statemachine-Pipeline-Stack"
            },
            "Resource": "arn:aws:states:::aws-sdk:iot:describeThing",
            "ResultSelector": {
                "Arn.$": "$.ThingArn",
                "Name.$": "$.ThingName"
            },
            "ResultPath": "$.IotThing"
        },
        "Get inference component version": {
            "Type": "Task",
            "Resource": "arn:aws:states:::lambda:invoke",
            "Parameters": {
                "FunctionName": "",
                "Payload": {
                    "ComponentName": "com.qualityinspection"
                }
            },
            "Retry": [
                {
                    "ErrorEquals": [
                        "Lambda.ServiceException",
                        "Lambda.AWSLambdaException",
                        "Lambda.SdkClientException"
                    ],
                    "IntervalSeconds": 2,
                    "MaxAttempts": 6,
                    "BackoffRate": 2
                }
            ],
            "Next": "Create new deployment",
            "ResultSelector": {
                "value.$": "$.Payload.LatestVersion"
            },
            "ResultPath": "$.InfererenceComponentVersion"
        },
        "Create new deployment": {
            "Type": "Task",
            "Parameters": {
                "TargetArn.$": "$.IotThing.Arn",
                "Components": {
                    "aws.greengrass.Nucleus": {
                        "ComponentVersion": "2.9.6",
                        "ConfigurationUpdate": {
                            "Merge": {
                                "DefaultConfiguration": {
                                    "interpolateComponentConfiguration": true
                                }
                            }
                        }
                    },
                    "aws.greengrass.Cli": {
                        "ComponentVersion": "2.9.6"
                    },
                    "com.qualityinspection.model": {
                        "ComponentVersion.$": "$.ModelNextVersion.value"
                    },
                    "com.qualityinspection": {
                        "ComponentVersion.$": "$.InfererenceComponentVersion.value",
                        "ConfigurationUpdate": {
                            "Merge": "{\"com.qualityinspection.model\":{\"VersionRequirement\": \">={com.qualityinspection.model:ComponentVersion}\", \"DependencyType\": \"HARD\"}}"
                        }
                    }
                }
            },
            "Resource": "arn:aws:states:::aws-sdk:greengrassv2:createDeployment",
            "Next": "Wait for deployment state change",
            "ResultSelector": {
                "value.$": "$.DeploymentId"
            },
            "ResultPath": "$.DeploymentId"
        },
        "Wait for deployment state change": {
            "Type": "Wait",
            "Seconds": 5,
            "Next": "Get deployment state"
        },
        "Get deployment state": {
            "Type": "Task",
            "Parameters": {
                "DeploymentId.$": "$.DeploymentId.value"
            },
            "Resource": "arn:aws:states:::aws-sdk:greengrassv2:getDeployment",
            "Next": "Check deployment state",
            "ResultSelector": {
                "value.$": "$.DeploymentStatus"
            },
            "ResultPath": "$.DeploymentStatus"
        },
        "Check deployment state": {
            "Type": "Choice",
            "Choices": [
                {
                    "Variable": "$.DeploymentStatus.value",
                    "StringMatches": "COMPLETED",
                    "Next": "Wait for device state change"
                },
                {
                    "Variable": "$.DeploymentStatus.value",
                    "StringMatches": "ACTIVE",
                    "Next": "Wait for deployment state change"
                }
            ],
            "Default": "Fail"
        },
        "Wait for device state change": {
            "Type": "Wait",
            "Seconds": 5,
            "Next": "Get core device state"
        },
        "Get core device state": {
            "Type": "Task",
            "Next": "Check core device state",
            "Parameters": {
                "CoreDeviceThingName.$": "$.IotThing.Name"
            },
            "Resource": "arn:aws:states:::aws-sdk:greengrassv2:getCoreDevice",
            "ResultSelector": {
                "value.$": "$.Status"
            },
            "ResultPath": "$.CoreDeviceStatus"
        },
        "Check core device state": {
            "Type": "Choice",
            "Choices": [
                {
                    "Variable": "$.CoreDeviceStatus.value",
                    "StringMatches": "HEALTHY",
                    "Next": "Success"
                }
            ],
            "Default": "Fail"
        },
        "Success": {
            "Type": "Succeed"
        },
        "Fail": {
            "Type": "Fail"
        }
    },
    "TimeoutSeconds": 600
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRnZS1kZXBsb3ltZW50LW9yY2hlc3RyYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlZGdlLWRlcGxveW1lbnQtb3JjaGVzdHJhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxrRUFBa0U7QUFDbEUsNkNBTXFCO0FBQ3JCLG1GQUFtRztBQUNuRyxxRUFBNkQ7QUFDN0QsMkNBQXVDO0FBQ3ZDLDZCQUE2QjtBQU03QixNQUFhLG9DQUFxQyxTQUFRLHNCQUFTO0lBUWpFLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0Q7O1FBQ3hGLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsSUFBSSxDQUFDLGdCQUFnQixHQUFHLCtCQUErQixtQkFBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUVsRixNQUFNLGdCQUFnQixHQUFHLElBQUkscUJBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLDhCQUE4QixFQUFFO1lBQzFFLFNBQVMsRUFBRSxJQUFJLHFCQUFHLENBQUMsZ0JBQWdCLENBQUMsc0JBQXNCLENBQUM7WUFDM0QsZUFBZSxFQUFFO2dCQUNmLHFCQUFHLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLDJCQUEyQixDQUFDO2dCQUN2RSxxQkFBRyxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQyxvQkFBb0IsQ0FBQztnQkFDaEUscUJBQUcsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsc0JBQXNCLENBQUM7Z0JBQ2xFLHFCQUFHLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLHlCQUF5QixDQUFDO2dCQUNyRSxxQkFBRyxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQyxrQkFBa0IsQ0FBQztnQkFDOUQscUJBQUcsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsc0JBQXNCLENBQUM7YUFDbkU7U0FDRixDQUFDLENBQUM7UUFDSCxNQUFB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QUNELFNBQVMsRUFBRSxNQUFNO1NBQ2xCO1FBQ0QsU0FBUyxFQUFFO1lBQ1QsTUFBTSxFQUFFLFNBQVM7U0FDbEI7UUFDRCxNQUFNLEVBQUU7WUFDTixNQUFNLEVBQUUsTUFBTTtTQUNmO0tBQ0Y7SUFDRCxnQkFBZ0IsRUFBRSxHQUFHO0NBQ3RCLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBsYW1iZGFfcHl0aG9uIGZyb20gJ0Bhd3MtY2RrL2F3cy1sYW1iZGEtcHl0aG9uLWFscGhhJztcbmltcG9ydCB7XG4gIGF3c19pYW0gYXMgaWFtLFxuICBhd3NfbGFtYmRhIGFzIGxhbWJkYSxcbiAgYXdzX2xvZ3MgYXMgbG9ncywgYXdzX3N0ZXBmdW5jdGlvbnMgYXMgc3RlcGZ1bmN0aW9ucyxcbiAgRHVyYXRpb24sXG4gIFN0YWNrXG59IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IFN0YXRlTWFjaGluZUlucHV0LCBTdGVwRnVuY3Rpb25JbnZva2VBY3Rpb24gfSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWNvZGVwaXBlbGluZS1hY3Rpb25zXCI7XG5pbXBvcnQgeyBTdGF0ZU1hY2hpbmUgfSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnNcIjtcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IEFwcENvbmZpZyB9IGZyb20gJy4uLy4uL2Jpbi9hcHAnXG5cbmV4cG9ydCBpbnRlcmZhY2UgRWRnZURlcGxveW1lbnRPcmNoZXN0cmF0aW9uQ29uc3RydWN0UHJvcHMgZXh0ZW5kcyBBcHBDb25maWcge1xuICBpb3RUaGluZ05hbWU6IHN0cmluZztcbn1cbmV4cG9ydCBjbGFzcyBFZGdlRGVwbG95bWVudE9yY2hlc3RyYXRpb25Db25zdHJ1Y3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuXG4gIHN0YXRpYyByZWFkb25seSBNT0RFTF9QQUNLQUdFX0dST1VQX05BTUUgPSAnVGFnUXVhbGl0eUluc3BlY3Rpb25QYWNrYWdlR3JvdXAnO1xuXG4gIHJlYWRvbmx5IHN0ZXBGdW5jdGlvbk5hbWU6IHN0cmluZztcbiAgcmVhZG9ubHkgc3RlcEZ1bmN0aW9uQXJuOiBzdHJpbmc7XG4gIHJlYWRvbmx5IHN0ZXBGdW5jdGlvbkFjdGlvbjogU3RlcEZ1bmN0aW9uSW52b2tlQWN0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBFZGdlRGVwbG95bWVudE9yY2hlc3RyYXRpb25Db25zdHJ1Y3RQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICB0aGlzLnN0ZXBGdW5jdGlvbk5hbWUgPSBgRWRnZURlcGxveW1lbnRPcmNoZXN0cmF0aW9uLSR7U3RhY2sub2YodGhpcykuc3RhY2tOYW1lfWA7XG5cbiAgICBjb25zdCBzdGVwRnVuY3Rpb25Sb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdlZGdlLXBhY2thZ2luZy1zZm4tZXhlYy1yb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ3N0YXRlcy5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdBbWF6b25TYWdlTWFrZXJGdWxsQWNjZXNzJyksXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQW1hem9uUzNGdWxsQWNjZXNzJyksXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQVdTTGFtYmRhX0Z1bGxBY2Nlc3MnKSxcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdBV1NHcmVlbmdyYXNzRnVsbEFjY2VzcycpLFxuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0FXU0lvVEZ1bGxBY2Nlc3MnKSxcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdDbG91ZFdhdGNoRnVsbEFjY2VzcycpXG4gICAgICBdLFxuICAgIH0pO1xuICAgIHN0ZXBGdW5jdGlvblJvbGUuYXNzdW1lUm9sZVBvbGljeT8uYWRkU3RhdGVtZW50cyhcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogWydzdHM6QXNzdW1lUm9sZSddLFxuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHByaW5jaXBhbHM6IFtcbiAgICAgICAgICBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ3NhZ2VtYWtlci5hbWF6b25hd3MuY29tJyksXG4gICAgICAgIF0sXG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgY29uc3QgbGFtYmRhUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnZWRnZS1wYWNrYWdpbmctbGFtYmRhLWV4ZWMtcm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQVdTR3JlZW5ncmFzc1JlYWRPbmx5QWNjZXNzJyksXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQW1hem9uU1NNRnVsbEFjY2VzcycpLFxuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0FtYXpvblNhZ2VNYWtlckZ1bGxBY2Nlc3MnKVxuICAgICAgXVxuICAgIH0pO1xuXG4gICAgY29uc3QgZmluZExhdGVzdENvbXBvbmVudFZlcnNpb25GdW5jdGlvbiA9IG5ldyBsYW1iZGFfcHl0aG9uLlB5dGhvbkZ1bmN0aW9uKHRoaXMsICdMYXRlc3RDb21wb25lbnRWZXJzaW9uJywge1xuICAgICAgZW50cnk6IHBhdGguam9pbignbGliJywgJ2Fzc2V0cycsICdnZ19jb21wb25lbnRfdmVyc2lvbl9oZWxwZXInKSxcbiAgICAgIGluZGV4OiAnc2V0dXAucHknLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfREFZLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLnNlY29uZHMoMTUpLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgJ1NBR0VNQUtFUl9ST0xFX0FSTic6IHN0ZXBGdW5jdGlvblJvbGUucm9sZUFyblxuICAgICAgfVxuICAgIH0pO1xuICAgIGNvbnN0IGZpbmRNb2RlbEJsb2JVUkwgPSBuZXcgbGFtYmRhX3B5dGhvbi5QeXRob25GdW5jdGlvbih0aGlzLCAnTW9kZWxCbG9iVVJMJywge1xuICAgICAgZW50cnk6IHBhdGguam9pbignbGliJywgJ2Fzc2V0cycsICdtb2RlbF92ZXJzaW9uX2hlbHBlcicpLFxuICAgICAgaW5kZXg6ICdzZXR1cC5weScsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9EQVksXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgdGltZW91dDogRHVyYXRpb24uc2Vjb25kcygxNSksXG4gICAgfSk7XG5cbiAgICBhc2wuU3RhdGVzWydHZXQgbW9kZWwgYmxvYiB1cmwnXS5QYXJhbWV0ZXJzLkZ1bmN0aW9uTmFtZSA9IGZpbmRNb2RlbEJsb2JVUkwuZnVuY3Rpb25Bcm47XG4gICAgYXNsLlN0YXRlc1snR2V0IG5leHQgR3JlZW5ncmFzcyBtb2RlbCBjb21wb25lbnQgdmVyc2lvbiddLlBhcmFtZXRlcnMuRnVuY3Rpb25OYW1lID0gZmluZExhdGVzdENvbXBvbmVudFZlcnNpb25GdW5jdGlvbi5mdW5jdGlvbkFybjtcbiAgICBhc2wuU3RhdGVzWydHZXQgbmV4dCBHcmVlbmdyYXNzIG1vZGVsIGNvbXBvbmVudCB2ZXJzaW9uJ10uUGFyYW1ldGVycy5QYXlsb2FkLkNvbXBvbmVudE5hbWUgPSBwcm9wcy5kZXBsb3ltZW50UHJvcHMuZ2dNb2RlbENvbXBvbmVudE5hbWU7XG4gICAgYXNsLlN0YXRlc1snR2V0IGluZmVyZW5jZSBjb21wb25lbnQgdmVyc2lvbiddLlBhcmFtZXRlcnMuRnVuY3Rpb25OYW1lID0gZmluZExhdGVzdENvbXBvbmVudFZlcnNpb25GdW5jdGlvbi5mdW5jdGlvbkFybjtcbiAgICBhc2wuU3RhdGVzWydHZXQgaW5mZXJlbmNlIGNvbXBvbmVudCB2ZXJzaW9uJ10uUGFyYW1ldGVycy5QYXlsb2FkLkNvbXBvbmVudE5hbWUgPSBwcm9wcy5kZXBsb3ltZW50UHJvcHMuZ2dJbmZlcmVuY2VDb21wb25lbnROYW1lO1xuICAgIGFzbC5TdGF0ZXNbJ0dldCBJb1QgVGhpbmcgQVJOJ10uUGFyYW1ldGVycy5UaGluZ05hbWUgPSBwcm9wcy5pb3RUaGluZ05hbWU7XG5cbiAgICBjb25zdCBwYWNrYWdlTW9kZWxXb3JrZmxvdyA9IG5ldyBzdGVwZnVuY3Rpb25zLkNmblN0YXRlTWFjaGluZSh0aGlzLCAnRWRnZURlcGxveW1lbnRPcmNoZXN0cmF0aW9uU3RlcEZ1bmN0aW9uJywge1xuICAgICAgcm9sZUFybjogc3RlcEZ1bmN0aW9uUm9sZS5yb2xlQXJuLFxuICAgICAgZGVmaW5pdGlvblN0cmluZzogSlNPTi5zdHJpbmdpZnkoYXNsKSxcbiAgICAgIHN0YXRlTWFjaGluZU5hbWU6IHRoaXMuc3RlcEZ1bmN0aW9uTmFtZVxuICAgIH0pO1xuXG4gICAgY29uc3Qgc3RlcEZ1bmN0aW9uSW5wdXQgPSB7XG4gICAgICBcIk1vZGVsUGFja2FnZUdyb3VwTmFtZVwiOiBwcm9wcy5kZXBsb3ltZW50UHJvcHMuc21Nb2RlbFBhY2thZ2VHcm91cE5hbWUsXG4gICAgICBcImludm9rYXRpb25Tb3VyY2VcIjogXCJDb2RlQnVpbGRcIixcbiAgICAgIFwibW9kZWxBcm5cIjogXCJcIlxuICAgIH1cblxuICAgIHRoaXMuc3RlcEZ1bmN0aW9uQXJuID0gYGFybjphd3M6c3RhdGVzOiR7U3RhY2sub2YodGhpcykucmVnaW9ufToke1N0YWNrLm9mKHRoaXMpLmFjY291bnR9OnN0YXRlTWFjaGluZToke3RoaXMuc3RlcEZ1bmN0aW9uTmFtZX1gO1xuXG4gICAgdGhpcy5zdGVwRnVuY3Rpb25BY3Rpb24gPSBuZXcgU3RlcEZ1bmN0aW9uSW52b2tlQWN0aW9uKHtcbiAgICAgIGFjdGlvbk5hbWU6ICdJbnZva2UnLFxuICAgICAgc3RhdGVNYWNoaW5lOiBTdGF0ZU1hY2hpbmUuZnJvbVN0YXRlTWFjaGluZUFybih0aGlzLCAnc3RhdGUtbWFjaGluZS1mcm9tLWFybicsIHRoaXMuc3RlcEZ1bmN0aW9uQXJuKSxcbiAgICAgIHN0YXRlTWFjaGluZUlucHV0OiBTdGF0ZU1hY2hpbmVJbnB1dC5saXRlcmFsKHN0ZXBGdW5jdGlvbklucHV0KVxuICAgIH0pXG4gIH1cbn1cblxuLy8gVE9ETzogIEFkZCBuYXRpdmUgQ0RLIGRlZmluaXRpb25cbmNvbnN0IGFzbCA9IHtcbiAgXCJTdGFydEF0XCI6IFwiR2V0IG1vZGVsIGJsb2IgdXJsXCIsXG4gIFwiU3RhdGVzXCI6IHtcbiAgICBcIkdldCBtb2RlbCBibG9iIHVybFwiOiB7XG4gICAgICBcIlR5cGVcIjogXCJUYXNrXCIsXG4gICAgICBcIk5leHRcIjogXCJHZXQgbmV4dCBHcmVlbmdyYXNzIG1vZGVsIGNvbXBvbmVudCB2ZXJzaW9uXCIsXG4gICAgICBcIlJlc291cmNlXCI6IFwiYXJuOmF3czpzdGF0ZXM6OjpsYW1iZGE6aW52b2tlXCIsXG4gICAgICBcIlBhcmFtZXRlcnNcIjoge1xuICAgICAgICBcIkZ1bmN0aW9uTmFtZVwiOiBcIlwiLFxuICAgICAgICBcIlBheWxvYWQuJFwiOiBcIiRcIlxuICAgICAgfSxcbiAgICAgIFwiUmV0cnlcIjogW1xuICAgICAgICB7XG4gICAgICAgICAgXCJFcnJvckVxdWFsc1wiOiBbXG4gICAgICAgICAgICBcIkxhbWJkYS5TZXJ2aWNlRXhjZXB0aW9uXCIsXG4gICAgICAgICAgICBcIkxhbWJkYS5BV1NMYW1iZGFFeGNlcHRpb25cIixcbiAgICAgICAgICAgIFwiTGFtYmRhLlNka0NsaWVudEV4Y2VwdGlvblwiLFxuICAgICAgICAgICAgXCJMYW1iZGEuVG9vTWFueVJlcXVlc3RzRXhjZXB0aW9uXCJcbiAgICAgICAgICBdLFxuICAgICAgICAgIFwiSW50ZXJ2YWxTZWNvbmRzXCI6IDEsXG4gICAgICAgICAgXCJNYXhBdHRlbXB0c1wiOiAzLFxuICAgICAgICAgIFwiQmFja29mZlJhdGVcIjogMlxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgXCJSZXN1bHRTZWxlY3RvclwiOiB7XG4gICAgICAgIFwidmFsdWUuJFwiOiBcIiQuUGF5bG9hZC5Nb2RlbFVybFwiXG4gICAgICB9LFxuICAgICAgXCJSZXN1bHRQYXRoXCI6IFwiJC5Nb2RlbFVybFwiLFxuICAgIH0sXG4gICAgXCJHZXQgbmV4dCBHcmVlbmdyYXNzIG1vZGVsIGNvbXBvbmVudCB2ZXJzaW9uXCI6IHtcbiAgICAgIFwiVHlwZVwiOiBcIlRhc2tcIixcbiAgICAgIFwiTmV4dFwiOiBcIkNyZWF0ZSBuZXcgR3JlZW5ncmFzcyBtb2RlbCBjb21wb25lbnRcIixcbiAgICAgIFwiUmVzb3VyY2VcIjogXCJhcm46YXdzOnN0YXRlczo6OmxhbWJkYTppbnZva2VcIixcbiAgICAgIFwiUGFyYW1ldGVyc1wiOiB7XG4gICAgICAgIFwiRnVuY3Rpb25OYW1lXCI6IFwiXCIsXG4gICAgICAgIFwiUGF5bG9hZFwiOiB7XG4gICAgICAgICAgXCJDb21wb25lbnROYW1lXCI6IFwiY29tLnF1YWxpdHlpbnNwZWN0aW9uLm1vZGVsXCJcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIFwiUmV0cnlcIjogW1xuICAgICAgICB7XG4gICAgICAgICAgXCJFcnJvckVxdWFsc1wiOiBbXG4gICAgICAgICAgICBcIkxhbWJkYS5TZXJ2aWNlRXhjZXB0aW9uXCIsXG4gICAgICAgICAgICBcIkxhbWJkYS5BV1NMYW1iZGFFeGNlcHRpb25cIixcbiAgICAgICAgICAgIFwiTGFtYmRhLlNka0NsaWVudEV4Y2VwdGlvblwiXG4gICAgICAgICAgXSxcbiAgICAgICAgICBcIkludGVydmFsU2Vjb25kc1wiOiAyLFxuICAgICAgICAgIFwiTWF4QXR0ZW1wdHNcIjogNixcbiAgICAgICAgICBcIkJhY2tvZmZSYXRlXCI6IDJcbiAgICAgICAgfVxuICAgICAgXSxcbiAgICAgIFwiUmVzdWx0U2VsZWN0b3JcIjoge1xuICAgICAgICBcInZhbHVlLiRcIjogXCIkLlBheWxvYWQuTmV4dFZlcnNpb25cIlxuICAgICAgfSxcbiAgICAgIFwiUmVzdWx0UGF0aFwiOiBcIiQuTW9kZWxOZXh0VmVyc2lvblwiXG4gICAgfSxcbiAgICBcIkNyZWF0ZSBuZXcgR3JlZW5ncmFzcyBtb2RlbCBjb21wb25lbnRcIjoge1xuICAgICAgXCJUeXBlXCI6IFwiVGFza1wiLFxuICAgICAgXCJOZXh0XCI6IFwiR2V0IElvVCBUaGluZyBBUk5cIixcbiAgICAgIFwiUGFyYW1ldGVyc1wiOiB7XG4gICAgICAgIFwiSW5saW5lUmVjaXBlXCI6IHtcbiAgICAgICAgICBcIlJlY2lwZUZvcm1hdFZlcnNpb25cIjogXCIyMDIwLTAxLTI1XCIsXG4gICAgICAgICAgXCJDb21wb25lbnROYW1lXCI6IFwiY29tLnF1YWxpdHlpbnNwZWN0aW9uLm1vZGVsXCIsXG4gICAgICAgICAgXCJDb21wb25lbnRWZXJzaW9uLiRcIjogXCIkLk1vZGVsTmV4dFZlcnNpb24udmFsdWVcIixcbiAgICAgICAgICBcIkNvbXBvbmVudFB1Ymxpc2hlclwiOiBcIkFXU1wiLFxuICAgICAgICAgIFwiTWFuaWZlc3RzXCI6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgXCJQbGF0Zm9ybVwiOiB7XG4gICAgICAgICAgICAgICAgXCJvc1wiOiBcIipcIixcbiAgICAgICAgICAgICAgICBcImFyY2hpdGVjdHVyZVwiOiBcIipcIlxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBcIkxpZmVjeWNsZVwiOiB7XG4gICAgICAgICAgICAgICAgXCJJbnN0YWxsXCI6IHtcbiAgICAgICAgICAgICAgICAgIFwiU2NyaXB0XCI6IFwidGFyIHh6ZiB7YXJ0aWZhY3RzOnBhdGh9L21vZGVsLnRhci5neiAtQyB7YXJ0aWZhY3RzOmRlY29tcHJlc3NlZFBhdGh9XCIsXG4gICAgICAgICAgICAgICAgICBcIlJlcXVpcmVzUHJpdmlsZWdlXCI6IHRydWVcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIFwiVXBncmFkZVwiOiB7XG4gICAgICAgICAgICAgICAgICBcIlNjcmlwdFwiOiBcInRhciB4emYge2FydGlmYWN0czpwYXRofS9tb2RlbC50YXIuZ3ogLUMge2FydGlmYWN0czpkZWNvbXByZXNzZWRQYXRofVwiLFxuICAgICAgICAgICAgICAgICAgXCJSZXF1aXJlc1ByaXZpbGVnZVwiOiB0cnVlXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBcIlVuaW5zdGFsbFwiOiB7XG4gICAgICAgICAgICAgICAgICBcIlNjcmlwdFwiOiBcInJtIC1yZiB7YXJ0aWZhY3RzOmRlY29tcHJlc3NlZFBhdGh9IHthcnRpZmFjdHM6cGF0aH1cIixcbiAgICAgICAgICAgICAgICAgIFwiUmVxdWlyZXNQcml2aWxlZ2VcIjogdHJ1ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgXCJBcnRpZmFjdHNcIjogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIFwiVXJpLiRcIjogXCIkLk1vZGVsVXJsLnZhbHVlXCIsXG4gICAgICAgICAgICAgICAgICBcIlBlcm1pc3Npb25cIjoge1xuICAgICAgICAgICAgICAgICAgICBcIlJlYWRcIjogXCJPV05FUlwiLFxuICAgICAgICAgICAgICAgICAgICBcIkV4ZWN1dGVcIjogXCJOT05FXCJcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBcIlJlc291cmNlXCI6IFwiYXJuOmF3czpzdGF0ZXM6Ojphd3Mtc2RrOmdyZWVuZ3Jhc3N2MjpjcmVhdGVDb21wb25lbnRWZXJzaW9uXCIsXG4gICAgICBcIlJlc3VsdFBhdGhcIjogbnVsbFxuICAgIH0sXG4gICAgXCJHZXQgSW9UIFRoaW5nIEFSTlwiOiB7XG4gICAgICBcIlR5cGVcIjogXCJUYXNrXCIsXG4gICAgICBcIk5leHRcIjogXCJHZXQgaW5mZXJlbmNlIGNvbXBvbmVudCB2ZXJzaW9uXCIsXG4gICAgICBcIlBhcmFtZXRlcnNcIjoge1xuICAgICAgICBcIlRoaW5nTmFtZVwiOiBcIkVkZ2VUaGluZy1NTE9wcy1JbmZlcmVuY2UtU3RhdGVtYWNoaW5lLVBpcGVsaW5lLVN0YWNrXCJcbiAgICAgIH0sXG4gICAgICBcIlJlc291cmNlXCI6IFwiYXJuOmF3czpzdGF0ZXM6Ojphd3Mtc2RrOmlvdDpkZXNjcmliZVRoaW5nXCIsXG4gICAgICBcIlJlc3VsdFNlbGVjdG9yXCI6IHtcbiAgICAgICAgXCJBcm4uJFwiOiBcIiQuVGhpbmdBcm5cIixcbiAgICAgICAgXCJOYW1lLiRcIjogXCIkLlRoaW5nTmFtZVwiXG4gICAgICB9LFxuICAgICAgXCJSZXN1bHRQYXRoXCI6IFwiJC5Jb3RUaGluZ1wiXG4gICAgfSxcbiAgICBcIkdldCBpbmZlcmVuY2UgY29tcG9uZW50IHZlcnNpb25cIjoge1xuICAgICAgXCJUeXBlXCI6IFwiVGFza1wiLFxuICAgICAgXCJSZXNvdXJjZVwiOiBcImFybjphd3M6c3RhdGVzOjo6bGFtYmRhOmludm9rZVwiLFxuICAgICAgXCJQYXJhbWV0ZXJzXCI6IHtcbiAgICAgICAgXCJGdW5jdGlvbk5hbWVcIjogXCJcIixcbiAgICAgICAgXCJQYXlsb2FkXCI6IHtcbiAgICAgICAgICBcIkNvbXBvbmVudE5hbWVcIjogXCJjb20ucXVhbGl0eWluc3BlY3Rpb25cIlxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgXCJSZXRyeVwiOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBcIkVycm9yRXF1YWxzXCI6IFtcbiAgICAgICAgICAgIFwiTGFtYmRhLlNlcnZpY2VFeGNlcHRpb25cIixcbiAgICAgICAgICAgIFwiTGFtYmRhLkFXU0xhbWJkYUV4Y2VwdGlvblwiLFxuICAgICAgICAgICAgXCJMYW1iZGEuU2RrQ2xpZW50RXhjZXB0aW9uXCJcbiAgICAgICAgICBdLFxuICAgICAgICAgIFwiSW50ZXJ2YWxTZWNvbmRzXCI6IDIsXG4gICAgICAgICAgXCJNYXhBdHRlbXB0c1wiOiA2LFxuICAgICAgICAgIFwiQmFja29mZlJhdGVcIjogMlxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgXCJOZXh0XCI6IFwiQ3JlYXRlIG5ldyBkZXBsb3ltZW50XCIsXG4gICAgICBcIlJlc3VsdFNlbGVjdG9yXCI6IHtcbiAgICAgICAgXCJ2YWx1ZS4kXCI6IFwiJC5QYXlsb2FkLkxhdGVzdFZlcnNpb25cIlxuICAgICAgfSxcbiAgICAgIFwiUmVzdWx0UGF0aFwiOiBcIiQuSW5mZXJlcmVuY2VDb21wb25lbnRWZXJzaW9uXCJcbiAgICB9LFxuICAgIFwiQ3JlYXRlIG5ldyBkZXBsb3ltZW50XCI6IHtcbiAgICAgIFwiVHlwZVwiOiBcIlRhc2tcIixcbiAgICAgIFwiUGFyYW1ldGVyc1wiOiB7XG4gICAgICAgIFwiVGFyZ2V0QXJuLiRcIjogXCIkLklvdFRoaW5nLkFyblwiLFxuICAgICAgICBcIkNvbXBvbmVudHNcIjoge1xuICAgICAgICAgIFwiYXdzLmdyZWVuZ3Jhc3MuTnVjbGV1c1wiOiB7XG4gICAgICAgICAgICBcIkNvbXBvbmVudFZlcnNpb25cIjogXCIyLjkuNlwiLFxuICAgICAgICAgICAgXCJDb25maWd1cmF0aW9uVXBkYXRlXCI6IHtcbiAgICAgICAgICAgICAgXCJNZXJnZVwiOiB7XG4gICAgICAgICAgICAgICAgXCJEZWZhdWx0Q29uZmlndXJhdGlvblwiOiB7XG4gICAgICAgICAgICAgICAgICBcImludGVycG9sYXRlQ29tcG9uZW50Q29uZmlndXJhdGlvblwiOiB0cnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICBcImF3cy5ncmVlbmdyYXNzLkNsaVwiOiB7XG4gICAgICAgICAgICBcIkNvbXBvbmVudFZlcnNpb25cIjogXCIyLjkuNlwiXG4gICAgICAgICAgfSxcbiAgICAgICAgICBcImNvbS5xdWFsaXR5aW5zcGVjdGlvbi5tb2RlbFwiOiB7XG4gICAgICAgICAgICBcIkNvbXBvbmVudFZlcnNpb24uJFwiOiBcIiQuTW9kZWxOZXh0VmVyc2lvbi52YWx1ZVwiXG4gICAgICAgICAgfSxcbiAgICAgICAgICBcImNvbS5xdWFsaXR5aW5zcGVjdGlvblwiOiB7XG4gICAgICAgICAgICBcIkNvbXBvbmVudFZlcnNpb24uJFwiOiBcIiQuSW5mZXJlcmVuY2VDb21wb25lbnRWZXJzaW9uLnZhbHVlXCIsXG4gICAgICAgICAgICBcIkNvbmZpZ3VyYXRpb25VcGRhdGVcIjoge1xuICAgICAgICAgICAgICBcIk1lcmdlXCI6IFwie1xcXCJjb20ucXVhbGl0eWluc3BlY3Rpb24ubW9kZWxcXFwiOntcXFwiVmVyc2lvblJlcXVpcmVtZW50XFxcIjogXFxcIj49e2NvbS5xdWFsaXR5aW5zcGVjdGlvbi5tb2RlbDpDb21wb25lbnRWZXJzaW9ufVxcXCIsIFxcXCJEZXBlbmRlbmN5VHlwZVxcXCI6IFxcXCJIQVJEXFxcIn19XCJcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBcIlJlc291cmNlXCI6IFwiYXJuOmF3czpzdGF0ZXM6Ojphd3Mtc2RrOmdyZWVuZ3Jhc3N2MjpjcmVhdGVEZXBsb3ltZW50XCIsXG4gICAgICBcIk5leHRcIjogXCJXYWl0IGZvciBkZXBsb3ltZW50IHN0YXRlIGNoYW5nZVwiLFxuICAgICAgXCJSZXN1bHRTZWxlY3RvclwiOiB7XG4gICAgICAgIFwidmFsdWUuJFwiOiBcIiQuRGVwbG95bWVudElkXCJcbiAgICAgIH0sXG4gICAgICBcIlJlc3VsdFBhdGhcIjogXCIkLkRlcGxveW1lbnRJZFwiXG4gICAgfSxcbiAgICBcIldhaXQgZm9yIGRlcGxveW1lbnQgc3RhdGUgY2hhbmdlXCI6IHtcbiAgICAgIFwiVHlwZVwiOiBcIldhaXRcIixcbiAgICAgIFwiU2Vjb25kc1wiOiA1LFxuICAgICAgXCJOZXh0XCI6IFwiR2V0IGRlcGxveW1lbnQgc3RhdGVcIlxuICAgIH0sXG4gICAgXCJHZXQgZGVwbG95bWVudCBzdGF0ZVwiOiB7XG4gICAgICBcIlR5cGVcIjogXCJUYXNrXCIsXG4gICAgICBcIlBhcmFtZXRlcnNcIjoge1xuICAgICAgICBcIkRlcGxveW1lbnRJZC4kXCI6IFwiJC5EZXBsb3ltZW50SWQudmFsdWVcIlxuICAgICAgfSxcbiAgICAgIFwiUmVzb3VyY2VcIjogXCJhcm46YXdzOnN0YXRlczo6OmF3cy1zZGs6Z3JlZW5ncmFzc3YyOmdldERlcGxveW1lbnRcIixcbiAgICAgIFwiTmV4dFwiOiBcIkNoZWNrIGRlcGxveW1lbnQgc3RhdGVcIixcbiAgICAgIFwiUmVzdWx0U2VsZWN0b3JcIjoge1xuICAgICAgICBcInZhbHVlLiRcIjogXCIkLkRlcGxveW1lbnRTdGF0dXNcIlxuICAgICAgfSxcbiAgICAgIFwiUmVzdWx0UGF0aFwiOiBcIiQuRGVwbG95bWVudFN0YXR1c1wiXG4gICAgfSxcbiAgICBcIkNoZWNrIGRlcGxveW1lbnQgc3RhdGVcIjoge1xuICAgICAgXCJUeXBlXCI6IFwiQ2hvaWNlXCIsXG4gICAgICBcIkNob2ljZXNcIjogW1xuICAgICAgICB7XG4gICAgICAgICAgXCJWYXJpYWJsZVwiOiBcIiQuRGVwbG95bWVudFN0YXR1cy52YWx1ZVwiLFxuICAgICAgICAgIFwiU3RyaW5nTWF0Y2hlc1wiOiBcIkNPTVBMRVRFRFwiLFxuICAgICAgICAgIFwiTmV4dFwiOiBcIldhaXQgZm9yIGRldmljZSBzdGF0ZSBjaGFuZ2VcIlxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgXCJWYXJpYWJsZVwiOiBcIiQuRGVwbG95bWVudFN0YXR1cy52YWx1ZVwiLFxuICAgICAgICAgIFwiU3RyaW5nTWF0Y2hlc1wiOiBcIkFDVElWRVwiLFxuICAgICAgICAgIFwiTmV4dFwiOiBcIldhaXQgZm9yIGRlcGxveW1lbnQgc3RhdGUgY2hhbmdlXCJcbiAgICAgICAgfVxuICAgICAgXSxcbiAgICAgIFwiRGVmYXVsdFwiOiBcIkZhaWxcIlxuICAgIH0sXG4gICAgXCJXYWl0IGZvciBkZXZpY2Ugc3RhdGUgY2hhbmdlXCI6IHtcbiAgICAgIFwiVHlwZVwiOiBcIldhaXRcIixcbiAgICAgIFwiU2Vjb25kc1wiOiA1LFxuICAgICAgXCJOZXh0XCI6IFwiR2V0IGNvcmUgZGV2aWNlIHN0YXRlXCJcbiAgICB9LFxuICAgIFwiR2V0IGNvcmUgZGV2aWNlIHN0YXRlXCI6IHtcbiAgICAgIFwiVHlwZVwiOiBcIlRhc2tcIixcbiAgICAgIFwiTmV4dFwiOiBcIkNoZWNrIGNvcmUgZGV2aWNlIHN0YXRlXCIsXG4gICAgICBcIlBhcmFtZXRlcnNcIjoge1xuICAgICAgICBcIkNvcmVEZXZpY2VUaGluZ05hbWUuJFwiOiBcIiQuSW90VGhpbmcuTmFtZVwiXG4gICAgICB9LFxuICAgICAgXCJSZXNvdXJjZVwiOiBcImFybjphd3M6c3RhdGVzOjo6YXdzLXNkazpncmVlbmdyYXNzdjI6Z2V0Q29yZURldmljZVwiLFxuICAgICAgXCJSZXN1bHRTZWxlY3RvclwiOiB7XG4gICAgICAgIFwidmFsdWUuJFwiOiBcIiQuU3RhdHVzXCJcbiAgICAgIH0sXG4gICAgICBcIlJlc3VsdFBhdGhcIjogXCIkLkNvcmVEZXZpY2VTdGF0dXNcIlxuICAgIH0sXG4gICAgXCJDaGVjayBjb3JlIGRldmljZSBzdGF0ZVwiOiB7XG4gICAgICBcIlR5cGVcIjogXCJDaG9pY2VcIixcbiAgICAgIFwiQ2hvaWNlc1wiOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBcIlZhcmlhYmxlXCI6IFwiJC5Db3JlRGV2aWNlU3RhdHVzLnZhbHVlXCIsXG4gICAgICAgICAgXCJTdHJpbmdNYXRjaGVzXCI6IFwiSEVBTFRIWVwiLFxuICAgICAgICAgIFwiTmV4dFwiOiBcIlN1Y2Nlc3NcIlxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgXCJEZWZhdWx0XCI6IFwiRmFpbFwiXG4gICAgfSxcbiAgICBcIlN1Y2Nlc3NcIjoge1xuICAgICAgXCJUeXBlXCI6IFwiU3VjY2VlZFwiXG4gICAgfSxcbiAgICBcIkZhaWxcIjoge1xuICAgICAgXCJUeXBlXCI6IFwiRmFpbFwiXG4gICAgfVxuICB9LFxuICBcIlRpbWVvdXRTZWNvbmRzXCI6IDYwMFxufVxuIl19