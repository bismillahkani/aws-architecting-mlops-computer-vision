"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GgPrerequisitesConstruct = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const constructs_1 = require("constructs");
class GgPrerequisitesConstruct extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        this.iotThing = new aws_cdk_lib_1.aws_iot.CfnThing(this, 'thing-edge-inference', {
            thingName: `EdgeThing-${aws_cdk_lib_1.Stack.of(this).stackName}`
        });
        this.tokenExchangeRole = new aws_cdk_lib_1.aws_iam.Role(this, 'token-exchange-iam-role', {
            assumedBy: new aws_cdk_lib_1.aws_iam.CompositePrincipal(new aws_cdk_lib_1.aws_iam.ServicePrincipal('iot.amazonaws.com'), new aws_cdk_lib_1.aws_iam.ServicePrincipal('credentials.iot.amazonaws.com'), new aws_cdk_lib_1.aws_iam.ServicePrincipal('sagemaker.amazonaws.com')),
            managedPolicies: [
                aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
                aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonSageMakerEdgeDeviceFleetPolicy'),
                aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess')
            ]
        });
        const tokenExchangePolicyDoc = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "iot:DescribeCertificate",
                        "logs:CreateLogGroup",
                        "logs:CreateLogStream",
                        "logs:PutLogEvents",
                        "logs:DescribeLogStreams",
                        "iot:Connect",
                        "iot:Publish",
                        "iot:Subscribe",
                        "iot:Receive",
                        "s3:GetBucketLocation"
                    ],
                    "Resource": "*"
                },
                {
                    "Effect": "Allow",
                    "Action": [
                        "s3:GetObject"
                    ],
                    "Resource": [
                        // TODO remove this hard coded value
                        "arn:aws:s3:::greengrassstack-dev-modelartifactbuckettempb4b728-1a7jzrtqoktbd/*"
                    ]
                },
                {
                    "Effect": "Allow",
                    "Action": [
                        "iam:GetRole",
                        "iam:PassRole",
                    ],
                    "Resource": [
                        `arn:aws:iam::${aws_cdk_lib_1.Aws.ACCOUNT_ID}:role/${this.tokenExchangeRole.roleName}`
                    ]
                }
            ]
        };
        new aws_cdk_lib_1.aws_iam.ManagedPolicy(this, 'token-exchange-iam-policy', {
            document: aws_cdk_lib_1.aws_iam.PolicyDocument.fromJson(tokenExchangePolicyDoc),
            roles: [this.tokenExchangeRole],
            managedPolicyName: `${this.tokenExchangeRole.roleName}Access`
        });
        const roleAlias = new aws_cdk_lib_1.aws_iot.CfnRoleAlias(this, 'GGIoTRoleAlias', {
            roleArn: this.tokenExchangeRole.roleArn,
            roleAlias: props.ggProps.tokenExchangeRoleAlias,
        });
        new aws_cdk_lib_1.aws_iot.CfnPolicy(this, 'IoTPolicy', {
            policyDocument: {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": [
                            "iot:Publish",
                            "iot:Subscribe",
                            "iot:Receive",
                            "iot:Connect",
                            "greengrass:*"
                        ],
                        "Resource": [
                            "*"
                        ]
                    }
                ]
            },
            policyName: props.ggProps.thingIotPolicyName
        });
        const allowAssumeTokenExchangeRole = new aws_cdk_lib_1.aws_iot.CfnPolicy(this, 'allowAssumeTokenExchangeRole', {
            policyName: props.ggProps.allowAssumeTokenExchangeRolePolicyName,
            policyDocument: {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": "iot:AssumeRoleWithCertificate",
                        "Resource": roleAlias.attrRoleAliasArn
                    }
                ]
            }
        });
        allowAssumeTokenExchangeRole.node.addDependency(roleAlias);
    }
}
exports.GgPrerequisitesConstruct = GgPrerequisitesConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2ctcHJlcmVxdWlzaXRlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImdnLXByZXJlcXVpc2l0ZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsNkNBQXVFO0FBQ3ZFLDJDQUFxQztBQVVyQyxNQUFhLHdCQUF5QixTQUFRLHNCQUFTO0lBS25ELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0I7UUFDdEQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUkscUJBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQzNELFNBQVMsRUFBRSxhQUFhLG1CQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRTtTQUNyRCxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxxQkFBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUseUJBQXlCLEVBQUU7WUFDbkUsU0FBUyxFQUFFLElBQUkscUJBQUcsQ0FBQyxrQkFBa0IsQ0FDakMsSUFBSSxxQkFBRyxDQUFDLGdCQUFnQixDQUFDLG1CQUFtQixDQUFDLEVBQzdDLElBQUkscUJBQUcsQ0FBQyxnQkFBZ0IsQ0FBQywrQkFBK0IsQ0FBQyxFQUN6RCxJQUFJLHFCQUFHLENBQUMsZ0JBQWdCLENBQUMseUJBQXlCLENBQUMsQ0FDdEQ7WUFDRCxlQUFlLEVBQUU7Z0JBQ2IscUJBQUcsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsMkJBQTJCLENBQUM7Z0JBQ3ZFLHFCQUFHLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLG1EQUFtRCxDQUFDO2dCQUMvRixxQkFBRyxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQyxvQkFBb0IsQ0FBQzthQUNuRTtTQUNKLENBQUMsQ0FBQztRQUVILE1BQU0sc0JBQXNCLEdBQUc7WUFDM0IsU0FBUyxFQUFFLFlBQVk7WUFDdkIsV0FBVyxFQUFFO2dCQUNUO29CQUNJLFFBQVEsRUFBRSxPQUFPO29CQUNqQixRQUFRLEVBQUU7d0JBQ04seUJBQXlCO3dCQUN6QixxQkFBcUI7d0JBQ3JCLHNCQUFzQjt3QkFDdEIsbUJBQW1CO3dCQUNuQix5QkFBeUI7d0JBQ3pCLGFBQWE7d0JBQ2IsYUFBYTt3QkFDYixlQUFlO3dCQUNmLGFBQWE7d0JBQ2Isc0JBQXNCO3FCQUN6QjtvQkFDRCxVQUFVLEVBQUUsR0FBRztpQkFDbEI7Z0JBQ0Q7b0JBQ0ksUUFBUSxFQUFFLE9BQU87b0JBQ2pCLFFBQVEsRUFBRTt3QkFDTixjQUFjO3FCQUNqQjtvQkFDRCxVQUFVLEVBQUU7d0JBQ1Isb0NBQW9DO3dCQUNwQyxnRkFBZ0Y7cUJBQ25GO2lCQUNKO2dCQUNEO29CQUNJLFFBQVEsRUFBRSxPQUFPO29CQUNqQixRQUFRLEVBQUU7d0JBQ04sYUFBYTt3QkFDYixjQUFjO3FCQUNqQjtvQkFDRCxVQUFVLEVBQUU7d0JBQ1IsZ0JBQWdCLGlCQUFHLENBQUMsVUFBVSxTQUFTLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUU7cUJBQzNFO2lCQUNKO2FBQ0o7U0FDSixDQUFBO1FBRUQsSUFBSSxxQkFBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsMkJBQTJCLEVBQUU7WUFDckQsUUFBUSxFQUFFLHFCQUFHLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsQ0FBQztZQUM3RCxLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUM7WUFDL0IsaUJBQWlCLEVBQUUsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxRQUFRO1NBQ2hFLENBQUMsQ0FBQztRQUdILE1BQU0sU0FBUyxHQUFHLElBQUkscUJBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQzNELE9BQU8sRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsT0FBTztZQUN2QyxTQUFTLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxzQkFBc0I7U0FDbEQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxxQkFBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQ2pDLGNBQWMsRUFBRTtnQkFDWixTQUFTLEVBQUUsWUFBWTtnQkFDdkIsV0FBVyxFQUFFO29CQUNUO3dCQUNJLFFBQVEsRUFBRSxPQUFPO3dCQUNqQixRQUFRLEVBQUU7NEJBQ04sYUFBYTs0QkFDYixlQUFlOzRCQUNmLGFBQWE7NEJBQ2IsYUFBYTs0QkFDYixjQUFjO3lCQUNqQjt3QkFDRCxVQUFVLEVBQUU7NEJBQ1IsR0FBRzt5QkFDTjtxQkFDSjtpQkFDSjthQUNKO1lBQ0QsVUFBVSxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsa0JBQWtCO1NBQy9DLENBQUMsQ0FBQztRQUVILE1BQU0sNEJBQTRCLEdBQUcsSUFBSSxxQkFBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsOEJBQThCLEVBQUU7WUFDekYsVUFBVSxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsc0NBQXNDO1lBQ2hFLGNBQWMsRUFBRTtnQkFDWixTQUFTLEVBQUMsWUFBWTtnQkFDdEIsV0FBVyxFQUFFO29CQUNUO3dCQUNJLFFBQVEsRUFBRSxPQUFPO3dCQUNqQixRQUFRLEVBQUUsK0JBQStCO3dCQUN6QyxVQUFVLEVBQUUsU0FBUyxDQUFDLGdCQUFnQjtxQkFDekM7aUJBQ0o7YUFDSjtTQUNKLENBQUMsQ0FBQztRQUNILDRCQUE0QixDQUFDLElBQUksQ0FBQyxhQUFhLENBQUUsU0FBUyxDQUFFLENBQUM7SUFDakUsQ0FBQztDQUNKO0FBcEhELDREQW9IQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7QXdzLCBhd3NfaWFtIGFzIGlhbSwgYXdzX2lvdCBhcyBpb3QsIFN0YWNrfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQge0NvbnN0cnVjdH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBBcHBDb25maWcgfSBmcm9tICcuLi8uLi9iaW4vYXBwJ1xuXG5leHBvcnQgaW50ZXJmYWNlIEdnUmVxdWlyZW1lbnRDb25zdHJ1Y3RQcm9wcyB7XG4gICAgdGhpbmdJb3RQb2xpY3lOYW1lOiBzdHJpbmcsXG4gICAgdG9rZW5FeGNoYW5nZVJvbGVBbGlhczogc3RyaW5nLFxuICAgIGFsbG93QXNzdW1lVG9rZW5FeGNoYW5nZVJvbGVQb2xpY3lOYW1lOiBzdHJpbmcsXG4gICAgdGhpbmdOYW1lOiBzdHJpbmdcbn1cblxuZXhwb3J0IGNsYXNzIEdnUHJlcmVxdWlzaXRlc0NvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG5cbiAgICByZWFkb25seSBpb3RUaGluZzogaW90LkNmblRoaW5nO1xuICAgIHJlYWRvbmx5IHRva2VuRXhjaGFuZ2VSb2xlOiBpYW0uUm9sZTtcblxuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBcHBDb25maWcpIHtcbiAgICAgICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgICAgICB0aGlzLmlvdFRoaW5nID0gbmV3IGlvdC5DZm5UaGluZyh0aGlzLCAndGhpbmctZWRnZS1pbmZlcmVuY2UnLCB7XG4gICAgICAgICAgICB0aGluZ05hbWU6IGBFZGdlVGhpbmctJHtTdGFjay5vZih0aGlzKS5zdGFja05hbWV9YFxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLnRva2VuRXhjaGFuZ2VSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICd0b2tlbi1leGNoYW5nZS1pYW0tcm9sZScsIHtcbiAgICAgICAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5Db21wb3NpdGVQcmluY2lwYWwoXG4gICAgICAgICAgICAgICAgbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdpb3QuYW1hem9uYXdzLmNvbScpLFxuICAgICAgICAgICAgICAgIG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnY3JlZGVudGlhbHMuaW90LmFtYXpvbmF3cy5jb20nKSxcbiAgICAgICAgICAgICAgICBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ3NhZ2VtYWtlci5hbWF6b25hd3MuY29tJylcbiAgICAgICAgICAgICksXG4gICAgICAgICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0FtYXpvblNhZ2VNYWtlckZ1bGxBY2Nlc3MnKSxcbiAgICAgICAgICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BbWF6b25TYWdlTWFrZXJFZGdlRGV2aWNlRmxlZXRQb2xpY3knKSxcbiAgICAgICAgICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ0FtYXpvblMzRnVsbEFjY2VzcycpIFxuICAgICAgICAgICAgXVxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCB0b2tlbkV4Y2hhbmdlUG9saWN5RG9jID0ge1xuICAgICAgICAgICAgXCJWZXJzaW9uXCI6IFwiMjAxMi0xMC0xN1wiLFxuICAgICAgICAgICAgXCJTdGF0ZW1lbnRcIjogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJFZmZlY3RcIjogXCJBbGxvd1wiLFxuICAgICAgICAgICAgICAgICAgICBcIkFjdGlvblwiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICBcImlvdDpEZXNjcmliZUNlcnRpZmljYXRlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcImxvZ3M6Q3JlYXRlTG9nR3JvdXBcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwibG9nczpDcmVhdGVMb2dTdHJlYW1cIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwibG9nczpQdXRMb2dFdmVudHNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwibG9nczpEZXNjcmliZUxvZ1N0cmVhbXNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaW90OkNvbm5lY3RcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaW90OlB1Ymxpc2hcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiaW90OlN1YnNjcmliZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJpb3Q6UmVjZWl2ZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJzMzpHZXRCdWNrZXRMb2NhdGlvblwiXG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgIFwiUmVzb3VyY2VcIjogXCIqXCJcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJFZmZlY3RcIjogXCJBbGxvd1wiLFxuICAgICAgICAgICAgICAgICAgICBcIkFjdGlvblwiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICBcInMzOkdldE9iamVjdFwiXG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgIFwiUmVzb3VyY2VcIjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVE9ETyByZW1vdmUgdGhpcyBoYXJkIGNvZGVkIHZhbHVlXG4gICAgICAgICAgICAgICAgICAgICAgICBcImFybjphd3M6czM6OjpncmVlbmdyYXNzc3RhY2stZGV2LW1vZGVsYXJ0aWZhY3RidWNrZXR0ZW1wYjRiNzI4LTFhN2p6cnRxb2t0YmQvKlwiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJFZmZlY3RcIjogXCJBbGxvd1wiLFxuICAgICAgICAgICAgICAgICAgICBcIkFjdGlvblwiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICBcImlhbTpHZXRSb2xlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcImlhbTpQYXNzUm9sZVwiLFxuICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICBcIlJlc291cmNlXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIGBhcm46YXdzOmlhbTo6JHtBd3MuQUNDT1VOVF9JRH06cm9sZS8ke3RoaXMudG9rZW5FeGNoYW5nZVJvbGUucm9sZU5hbWV9YFxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9XG5cbiAgICAgICAgbmV3IGlhbS5NYW5hZ2VkUG9saWN5KHRoaXMsICd0b2tlbi1leGNoYW5nZS1pYW0tcG9saWN5Jywge1xuICAgICAgICAgICAgZG9jdW1lbnQ6IGlhbS5Qb2xpY3lEb2N1bWVudC5mcm9tSnNvbih0b2tlbkV4Y2hhbmdlUG9saWN5RG9jKSxcbiAgICAgICAgICAgIHJvbGVzOiBbdGhpcy50b2tlbkV4Y2hhbmdlUm9sZV0sXG4gICAgICAgICAgICBtYW5hZ2VkUG9saWN5TmFtZTogYCR7dGhpcy50b2tlbkV4Y2hhbmdlUm9sZS5yb2xlTmFtZX1BY2Nlc3NgXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgY29uc3Qgcm9sZUFsaWFzID0gbmV3IGlvdC5DZm5Sb2xlQWxpYXModGhpcywgJ0dHSW9UUm9sZUFsaWFzJywge1xuICAgICAgICAgICAgcm9sZUFybjogdGhpcy50b2tlbkV4Y2hhbmdlUm9sZS5yb2xlQXJuLFxuICAgICAgICAgICAgcm9sZUFsaWFzOiBwcm9wcy5nZ1Byb3BzLnRva2VuRXhjaGFuZ2VSb2xlQWxpYXMsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIG5ldyBpb3QuQ2ZuUG9saWN5KHRoaXMsICdJb1RQb2xpY3knLCB7XG4gICAgICAgICAgICBwb2xpY3lEb2N1bWVudDoge1xuICAgICAgICAgICAgICAgIFwiVmVyc2lvblwiOiBcIjIwMTItMTAtMTdcIixcbiAgICAgICAgICAgICAgICBcIlN0YXRlbWVudFwiOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiRWZmZWN0XCI6IFwiQWxsb3dcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiQWN0aW9uXCI6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImlvdDpQdWJsaXNoXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpb3Q6U3Vic2NyaWJlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJpb3Q6UmVjZWl2ZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaW90OkNvbm5lY3RcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImdyZWVuZ3Jhc3M6KlwiXG4gICAgICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJSZXNvdXJjZVwiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCIqXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwb2xpY3lOYW1lOiBwcm9wcy5nZ1Byb3BzLnRoaW5nSW90UG9saWN5TmFtZVxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBhbGxvd0Fzc3VtZVRva2VuRXhjaGFuZ2VSb2xlID0gbmV3IGlvdC5DZm5Qb2xpY3kodGhpcywgJ2FsbG93QXNzdW1lVG9rZW5FeGNoYW5nZVJvbGUnLCB7XG4gICAgICAgICAgICBwb2xpY3lOYW1lOiBwcm9wcy5nZ1Byb3BzLmFsbG93QXNzdW1lVG9rZW5FeGNoYW5nZVJvbGVQb2xpY3lOYW1lLFxuICAgICAgICAgICAgcG9saWN5RG9jdW1lbnQ6IHtcbiAgICAgICAgICAgICAgICBcIlZlcnNpb25cIjpcIjIwMTItMTAtMTdcIixcbiAgICAgICAgICAgICAgICBcIlN0YXRlbWVudFwiOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiRWZmZWN0XCI6IFwiQWxsb3dcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiQWN0aW9uXCI6IFwiaW90OkFzc3VtZVJvbGVXaXRoQ2VydGlmaWNhdGVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiUmVzb3VyY2VcIjogcm9sZUFsaWFzLmF0dHJSb2xlQWxpYXNBcm5cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGFsbG93QXNzdW1lVG9rZW5FeGNoYW5nZVJvbGUubm9kZS5hZGREZXBlbmRlbmN5KCByb2xlQWxpYXMgKTtcbiAgICB9XG59XG5cbiJdfQ==