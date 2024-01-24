"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GgOnEc2Construct = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const constructs_1 = require("constructs");
const gg_prerequisites_1 = require("./gg-prerequisites");
class GgOnEc2Construct extends constructs_1.Construct {
    constructor(scope, id, props) {
        var _a;
        super(scope, id);
        const requirementProps = {
            thingName: `EdgeThing-${aws_cdk_lib_1.Stack.of(this).stackName}`,
            thingIotPolicyName: props.ggProps.thingIotPolicyName,
            tokenExchangeRoleAlias: props.ggProps.tokenExchangeRoleAlias,
            allowAssumeTokenExchangeRolePolicyName: props.ggProps.allowAssumeTokenExchangeRolePolicyName
        };
        const ggPrerequisitesConstruct = new gg_prerequisites_1.GgPrerequisitesConstruct(this, 'greengrass-prerequisites', props);
        this.deviceRole = ggPrerequisitesConstruct.tokenExchangeRole;
        this.iotThingName = (_a = ggPrerequisitesConstruct.iotThing.thingName) !== null && _a !== void 0 ? _a : 'no-iot-thing-defined';
        const vpc = new aws_cdk_lib_1.aws_ec2.Vpc(this, 'vpc', {
            cidr: '10.0.0.0/16',
            restrictDefaultSecurityGroup: true,
        });
        const instanceRole = new aws_cdk_lib_1.aws_iam.Role(this, 'gg-instance-role', {
            assumedBy: new aws_cdk_lib_1.aws_iam.ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')]
        });
        // based on https://docs.aws.amazon.com/greengrass/v2/developerguide/provision-minimal-iam-policy.html
        instanceRole.addToPolicy(aws_cdk_lib_1.aws_iam.PolicyStatement.fromJson({
            "Effect": "Allow",
            "Action": [
                "iot:AddThingToThingGroup",
                "iot:AttachPolicy",
                "iot:AttachThingPrincipal",
                // TODO should we remove this somehow after the cert was created ?
                "iot:CreateKeysAndCertificate",
                "iot:CreatePolicy",
                "iot:CreateRoleAlias",
                "iot:CreateThing",
                "iot:CreateThingGroup",
                "iot:DescribeEndpoint",
                "iot:DescribeRoleAlias",
                "iot:DescribeThingGroup",
                "sts:GetCallerIdentity",
                "iot:GetPolicy"
            ],
            "Resource": "*"
        }));
        instanceRole.addToPolicy(aws_cdk_lib_1.aws_iam.PolicyStatement.fromJson({
            "Effect": "Allow",
            "Action": [
                "iam:AttachRolePolicy",
                "iam:CreatePolicy",
                "iam:CreateRole",
                "iam:GetPolicy",
                "iam:GetRole",
                "iam:PassRole",
            ],
            "Resource": [
                `arn:aws:iam::${aws_cdk_lib_1.Aws.ACCOUNT_ID}:role/${ggPrerequisitesConstruct.tokenExchangeRole.roleName}`,
                `arn:aws:iam::${aws_cdk_lib_1.Aws.ACCOUNT_ID}:policy/${ggPrerequisitesConstruct.tokenExchangeRole.roleName}Access`,
            ]
        }));
        instanceRole.addToPolicy(aws_cdk_lib_1.aws_iam.PolicyStatement.fromJson({
            "Sid": "DeployDevTools",
            "Effect": "Allow",
            "Action": [
                "greengrass:CreateDeployment",
                "iot:CancelJob",
                "iot:CreateJob",
                "iot:DeleteThingShadow",
                "iot:DescribeJob",
                "iot:DescribeThing",
                "iot:DescribeThingGroup",
                "iot:GetThingShadow",
                "iot:UpdateJob",
                "iot:UpdateThingShadow"
            ],
            "Resource": "*"
        }));
        const mlopsBucket = aws_cdk_lib_1.aws_s3.Bucket.fromBucketName(this, "mlops-bucket", props.assetsBucket);
        this.deviceRole.addToPolicy(aws_cdk_lib_1.aws_iam.PolicyStatement.fromJson({
            "Effect": "Allow",
            "Action": [
                "s3:GetObject*",
                "s3:PutObject*",
                "s3:GetBucket*",
                "s3:List*"
            ],
            "Resource": [
                mlopsBucket.bucketArn,
                `${mlopsBucket.bucketArn}/*`
            ]
        }));
        const userdata = aws_cdk_lib_1.aws_ec2.UserData.forLinux();
        userdata.addCommands('apt -y update', 'apt -y upgrade', 'apt -y install unzip python3-pip openjdk-11-jdk-headless build-essential libgl1-mesa-glx', 'curl -s https://d2s8p88vqu9w66.cloudfront.net/releases/greengrass-nucleus-latest.zip > greengrass-nucleus-latest.zip', 'unzip greengrass-nucleus-latest.zip -d GreengrassCore && rm greengrass-nucleus-latest.zip', 'java -Droot="/greengrass/v2" -Dlog.store=FILE ' +
            '  -jar ./GreengrassCore/lib/Greengrass.jar ' +
            `  --aws-region ${aws_cdk_lib_1.Stack.of(this).region} ` +
            `  --thing-name ${ggPrerequisitesConstruct.iotThing.thingName} ` +
            `  --tes-role-name ${ggPrerequisitesConstruct.tokenExchangeRole.roleName}` +
            `  --tes-role-alias-name  ${props.ggProps.tokenExchangeRoleAlias}` +
            `  --thing-policy-name  ${props.ggProps.thingIotPolicyName}` +
            '  --component-default-user ggc_user:ggc_group ' +
            '  --provision true ' +
            '  --setup-system-service true');
        const instance = new aws_cdk_lib_1.aws_ec2.Instance(this, `greengrass-instance`, {
            vpc: vpc,
            instanceType: aws_cdk_lib_1.aws_ec2.InstanceType.of(aws_cdk_lib_1.aws_ec2.InstanceClass.BURSTABLE3_AMD, aws_cdk_lib_1.aws_ec2.InstanceSize.SMALL),
            // Searched in marketplace for Canonical, Ubuntu, 20.04 LTS, amd64 focal image build on 2022-06-10
            machineImage: aws_cdk_lib_1.aws_ec2.MachineImage.genericLinux({
                'us-west-1': 'ami-01154c8b2e9a14885',
                'us-west-2': 'ami-0ddf424f81ddb0720',
                'us-east-1': 'ami-08d4ac5b634553e16',
                'us-east-2': 'ami-0960ab670c8bb45f3',
                'eu-west-1': 'ami-0d2a4a5d69e46ea0b',
                'eu-west-2': 'ami-0bd2099338bc55e6d',
                'eu-central-1': 'ami-0c9354388bb36c088',
                'ap-southeast-1': 'ami-04ff9e9b51c1f62ca',
                'ap-southeast-2': 'ami-0300dc03c13eb7660',
                'ap-south-1': 'ami-006d3995d3a6b963b',
                'ap-northeast-1': 'ami-0f8048fa3e3b9e8ff',
                'ap-northeast-2': 'ami-0ea5eb4b05645aa8a',
                'ca-central-1': 'ami-0665ce57d172e712e',
            }),
            role: instanceRole,
            instanceName: `Greengrass-${aws_cdk_lib_1.Stack.of(this).stackName}`,
            userData: userdata,
            blockDevices: [{
                    deviceName: '/dev/sda1',
                    volume: aws_cdk_lib_1.aws_ec2.BlockDeviceVolume.ebs(30, {
                        encrypted: true,
                        volumeType: aws_cdk_lib_1.aws_ec2.EbsDeviceVolumeType.GP3,
                        deleteOnTermination: true
                    })
                }]
        });
        instance.node.addDependency(ggPrerequisitesConstruct);
    }
}
exports.GgOnEc2Construct = GgOnEc2Construct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2ctb24tZWMyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZ2ctb24tZWMyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZDQUFxRjtBQUNyRiwyQ0FBdUM7QUFFdkMseURBQThEO0FBYTlELE1BQWEsZ0JBQWlCLFNBQVEsc0JBQVM7SUFLM0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFnQjs7UUFDdEQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixNQUFNLGdCQUFnQixHQUFHO1lBQ3JCLFNBQVMsRUFBRSxhQUFhLG1CQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRTtZQUNsRCxrQkFBa0IsRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLGtCQUFrQjtZQUNwRCxzQkFBc0IsRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLHNCQUFzQjtZQUM1RCxzQ0FBc0MsRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLHNDQUFzQztTQUMvRixDQUFBO1FBRUQsTUFBTSx3QkFBd0IsR0FBRyxJQUFJLDJDQUF3QixDQUFDLElBQUksRUFBRSwwQkFBMEIsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN2RyxJQUFJLENBQUMsVUFBVSxHQUFHLHdCQUF3QixDQUFDLGlCQUFpQixDQUFDO1FBQzdELElBQUksQ0FBQyxZQUFZLEdBQUcsTUFBQSx3QkFBd0IsQ0FBQyxRQUFRLENBQUMsU0FBUyxtQ0FBSSxzQkFBc0IsQ0FBQztRQUUxRixNQUFNLEdBQUcsR0FBRyxJQUFJLHFCQUFHLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7WUFDakMsSUFBSSxFQUFFLGFBQWE7WUFDbkIsNEJBQTRCLEVBQUUsSUFBSTtTQUNyQyxDQUFDLENBQUM7UUFFSCxNQUFNLFlBQVksR0FBRyxJQUFJLHFCQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUN4RCxTQUFTLEVBQUUs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Q0FBQyxFQUFFLEVBQUU7d0JBQ2xDLFNBQVMsRUFBRSxJQUFJO3dCQUNmLFVBQVUsRUFBRSxxQkFBRyxDQUFDLG1CQUFtQixDQUFDLEdBQUc7d0JBQ3ZDLG1CQUFtQixFQUFFLElBQUk7cUJBQzVCLENBQUM7aUJBQ0wsQ0FBQztTQUNMLENBQUMsQ0FBQztRQUVILFFBQVEsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLENBQUM7SUFDMUQsQ0FBQztDQUNKO0FBNUpELDRDQTRKQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7QXdzLCBhd3NfZWMyIGFzIGVjMiwgYXdzX2lhbSBhcyBpYW0sIGF3c19zMyBhcyBzMywgU3RhY2t9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgQXBwQ29uZmlnIH0gZnJvbSAnLi4vLi4vYmluL2FwcCdcbmltcG9ydCB7IEdnUHJlcmVxdWlzaXRlc0NvbnN0cnVjdCB9IGZyb20gXCIuL2dnLXByZXJlcXVpc2l0ZXNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBHZ09uRWMyQ29uc3RydWN0UHJvcHMge1xuICAgIHRoaW5nSW90UG9saWN5TmFtZTogc3RyaW5nXG4gICAgYWxsb3dBc3N1bWVUb2tlbkV4Y2hhbmdlUm9sZVBvbGljeU5hbWU6IHN0cmluZ1xuICAgIHRva2VuRXhjaGFuZ2VSb2xlQWxpYXM6IHN0cmluZ1xuICAgIGRldmljZUZsZWV0TmFtZTogc3RyaW5nXG4gICAgaW90VGhpbmdOYW1lOiBzdHJpbmcsXG4gICAgcGlwZWxpbmVBc3NldHNQcmVmaXg6IHN0cmluZ1xuICAgIHJlcG9OYW1lOiBzdHJpbmcsXG4gICAgYnJhbmNoTmFtZTogc3RyaW5nXG59XG5cbmV4cG9ydCBjbGFzcyBHZ09uRWMyQ29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcblxuICAgIHB1YmxpYyByZWFkb25seSBkZXZpY2VSb2xlOiBpYW0uUm9sZTtcbiAgICBwdWJsaWMgcmVhZG9ubHkgaW90VGhpbmdOYW1lOiBzdHJpbmc7XG5cbiAgICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQXBwQ29uZmlnKSB7XG4gICAgICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAgICAgY29uc3QgcmVxdWlyZW1lbnRQcm9wcyA9IHtcbiAgICAgICAgICAgIHRoaW5nTmFtZTogYEVkZ2VUaGluZy0ke1N0YWNrLm9mKHRoaXMpLnN0YWNrTmFtZX1gLFxuICAgICAgICAgICAgdGhpbmdJb3RQb2xpY3lOYW1lOiBwcm9wcy5nZ1Byb3BzLnRoaW5nSW90UG9saWN5TmFtZSxcbiAgICAgICAgICAgIHRva2VuRXhjaGFuZ2VSb2xlQWxpYXM6IHByb3BzLmdnUHJvcHMudG9rZW5FeGNoYW5nZVJvbGVBbGlhcyxcbiAgICAgICAgICAgIGFsbG93QXNzdW1lVG9rZW5FeGNoYW5nZVJvbGVQb2xpY3lOYW1lOiBwcm9wcy5nZ1Byb3BzLmFsbG93QXNzdW1lVG9rZW5FeGNoYW5nZVJvbGVQb2xpY3lOYW1lXG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBnZ1ByZXJlcXVpc2l0ZXNDb25zdHJ1Y3QgPSBuZXcgR2dQcmVyZXF1aXNpdGVzQ29uc3RydWN0KHRoaXMsICdncmVlbmdyYXNzLXByZXJlcXVpc2l0ZXMnLCBwcm9wcyk7XG4gICAgICAgIHRoaXMuZGV2aWNlUm9sZSA9IGdnUHJlcmVxdWlzaXRlc0NvbnN0cnVjdC50b2tlbkV4Y2hhbmdlUm9sZTtcbiAgICAgICAgdGhpcy5pb3RUaGluZ05hbWUgPSBnZ1ByZXJlcXVpc2l0ZXNDb25zdHJ1Y3QuaW90VGhpbmcudGhpbmdOYW1lID8/ICduby1pb3QtdGhpbmctZGVmaW5lZCc7XG5cbiAgICAgICAgY29uc3QgdnBjID0gbmV3IGVjMi5WcGModGhpcywgJ3ZwYycsIHtcbiAgICAgICAgICAgIGNpZHI6ICcxMC4wLjAuMC8xNicsXG4gICAgICAgICAgICByZXN0cmljdERlZmF1bHRTZWN1cml0eUdyb3VwOiB0cnVlLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBpbnN0YW5jZVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ2dnLWluc3RhbmNlLXJvbGUnLCB7XG4gICAgICAgICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnZWMyLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgICAgICAgIG1hbmFnZWRQb2xpY2llczogW2lhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQW1hem9uU1NNTWFuYWdlZEluc3RhbmNlQ29yZScpXVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBiYXNlZCBvbiBodHRwczovL2RvY3MuYXdzLmFtYXpvbi5jb20vZ3JlZW5ncmFzcy92Mi9kZXZlbG9wZXJndWlkZS9wcm92aXNpb24tbWluaW1hbC1pYW0tcG9saWN5Lmh0bWxcbiAgICAgICAgaW5zdGFuY2VSb2xlLmFkZFRvUG9saWN5KGlhbS5Qb2xpY3lTdGF0ZW1lbnQuZnJvbUpzb24oe1xuICAgICAgICAgICAgXCJFZmZlY3RcIjogXCJBbGxvd1wiLFxuICAgICAgICAgICAgXCJBY3Rpb25cIjogW1xuICAgICAgICAgICAgICAgIFwiaW90OkFkZFRoaW5nVG9UaGluZ0dyb3VwXCIsXG4gICAgICAgICAgICAgICAgXCJpb3Q6QXR0YWNoUG9saWN5XCIsXG4gICAgICAgICAgICAgICAgXCJpb3Q6QXR0YWNoVGhpbmdQcmluY2lwYWxcIixcbiAgICAgICAgICAgICAgICAvLyBUT0RPIHNob3VsZCB3ZSByZW1vdmUgdGhpcyBzb21laG93IGFmdGVyIHRoZSBjZXJ0IHdhcyBjcmVhdGVkID9cbiAgICAgICAgICAgICAgICBcImlvdDpDcmVhdGVLZXlzQW5kQ2VydGlmaWNhdGVcIixcbiAgICAgICAgICAgICAgICBcImlvdDpDcmVhdGVQb2xpY3lcIixcbiAgICAgICAgICAgICAgICBcImlvdDpDcmVhdGVSb2xlQWxpYXNcIixcbiAgICAgICAgICAgICAgICBcImlvdDpDcmVhdGVUaGluZ1wiLFxuICAgICAgICAgICAgICAgIFwiaW90OkNyZWF0ZVRoaW5nR3JvdXBcIixcbiAgICAgICAgICAgICAgICBcImlvdDpEZXNjcmliZUVuZHBvaW50XCIsXG4gICAgICAgICAgICAgICAgXCJpb3Q6RGVzY3JpYmVSb2xlQWxpYXNcIixcbiAgICAgICAgICAgICAgICBcImlvdDpEZXNjcmliZVRoaW5nR3JvdXBcIixcbiAgICAgICAgICAgICAgICBcInN0czpHZXRDYWxsZXJJZGVudGl0eVwiLFxuICAgICAgICAgICAgICAgIFwiaW90OkdldFBvbGljeVwiXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgXCJSZXNvdXJjZVwiOiBcIipcIlxuICAgICAgICB9KSk7XG4gICAgICAgIGluc3RhbmNlUm9sZS5hZGRUb1BvbGljeShpYW0uUG9saWN5U3RhdGVtZW50LmZyb21Kc29uKHtcbiAgICAgICAgICAgIFwiRWZmZWN0XCI6IFwiQWxsb3dcIixcbiAgICAgICAgICAgIFwiQWN0aW9uXCI6IFtcbiAgICAgICAgICAgICAgICBcImlhbTpBdHRhY2hSb2xlUG9saWN5XCIsXG4gICAgICAgICAgICAgICAgXCJpYW06Q3JlYXRlUG9saWN5XCIsXG4gICAgICAgICAgICAgICAgXCJpYW06Q3JlYXRlUm9sZVwiLFxuICAgICAgICAgICAgICAgIFwiaWFtOkdldFBvbGljeVwiLFxuICAgICAgICAgICAgICAgIFwiaWFtOkdldFJvbGVcIixcbiAgICAgICAgICAgICAgICBcImlhbTpQYXNzUm9sZVwiLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIFwiUmVzb3VyY2VcIjogW1xuICAgICAgICAgICAgICAgIGBhcm46YXdzOmlhbTo6JHtBd3MuQUNDT1VOVF9JRH06cm9sZS8ke2dnUHJlcmVxdWlzaXRlc0NvbnN0cnVjdC50b2tlbkV4Y2hhbmdlUm9sZS5yb2xlTmFtZX1gLFxuICAgICAgICAgICAgICAgIGBhcm46YXdzOmlhbTo6JHtBd3MuQUNDT1VOVF9JRH06cG9saWN5LyR7Z2dQcmVyZXF1aXNpdGVzQ29uc3RydWN0LnRva2VuRXhjaGFuZ2VSb2xlLnJvbGVOYW1lfUFjY2Vzc2AsXG4gICAgICAgICAgICBdXG4gICAgICAgIH0pKTtcblxuXG5cbiAgICAgICAgaW5zdGFuY2VSb2xlLmFkZFRvUG9saWN5KGlhbS5Qb2xpY3lTdGF0ZW1lbnQuZnJvbUpzb24oe1xuICAgICAgICAgICAgXCJTaWRcIjogXCJEZXBsb3lEZXZUb29sc1wiLFxuICAgICAgICAgICAgXCJFZmZlY3RcIjogXCJBbGxvd1wiLFxuICAgICAgICAgICAgXCJBY3Rpb25cIjogW1xuICAgICAgICAgICAgICAgIFwiZ3JlZW5ncmFzczpDcmVhdGVEZXBsb3ltZW50XCIsXG4gICAgICAgICAgICAgICAgXCJpb3Q6Q2FuY2VsSm9iXCIsXG4gICAgICAgICAgICAgICAgXCJpb3Q6Q3JlYXRlSm9iXCIsXG4gICAgICAgICAgICAgICAgXCJpb3Q6RGVsZXRlVGhpbmdTaGFkb3dcIixcbiAgICAgICAgICAgICAgICBcImlvdDpEZXNjcmliZUpvYlwiLFxuICAgICAgICAgICAgICAgIFwiaW90OkRlc2NyaWJlVGhpbmdcIixcbiAgICAgICAgICAgICAgICBcImlvdDpEZXNjcmliZVRoaW5nR3JvdXBcIixcbiAgICAgICAgICAgICAgICBcImlvdDpHZXRUaGluZ1NoYWRvd1wiLFxuICAgICAgICAgICAgICAgIFwiaW90OlVwZGF0ZUpvYlwiLFxuICAgICAgICAgICAgICAgIFwiaW90OlVwZGF0ZVRoaW5nU2hhZG93XCJcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBcIlJlc291cmNlXCI6IFwiKlwiXG5cbiAgICAgICAgfSkpO1xuICAgICAgICBjb25zdCBtbG9wc0J1Y2tldCA9IHMzLkJ1Y2tldC5mcm9tQnVja2V0TmFtZSh0aGlzLCBcIm1sb3BzLWJ1Y2tldFwiLCBwcm9wcy5hc3NldHNCdWNrZXQpXG4gICAgICAgIHRoaXMuZGV2aWNlUm9sZS5hZGRUb1BvbGljeShpYW0uUG9saWN5U3RhdGVtZW50LmZyb21Kc29uKHtcbiAgICAgICAgICAgIFwiRWZmZWN0XCI6IFwiQWxsb3dcIixcbiAgICAgICAgICAgIFwiQWN0aW9uXCI6IFtcbiAgICAgICAgICAgICAgICBcInMzOkdldE9iamVjdCpcIixcbiAgICAgICAgICAgICAgICBcInMzOlB1dE9iamVjdCpcIixcbiAgICAgICAgICAgICAgICBcInMzOkdldEJ1Y2tldCpcIixcbiAgICAgICAgICAgICAgICBcInMzOkxpc3QqXCJcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBcIlJlc291cmNlXCI6IFtcbiAgICAgICAgICAgICAgICBtbG9wc0J1Y2tldC5idWNrZXRBcm4sXG4gICAgICAgICAgICAgICAgYCR7bWxvcHNCdWNrZXQuYnVja2V0QXJufS8qYFxuICAgICAgICAgICAgXVxuICAgICAgICB9KSk7XG5cbiAgICAgICAgY29uc3QgdXNlcmRhdGEgPSBlYzIuVXNlckRhdGEuZm9yTGludXgoKTtcbiAgICAgICAgdXNlcmRhdGEuYWRkQ29tbWFuZHMoXG4gICAgICAgICAgICAnYXB0IC15IHVwZGF0ZScsXG4gICAgICAgICAgICAnYXB0IC15IHVwZ3JhZGUnLFxuICAgICAgICAgICAgJ2FwdCAteSBpbnN0YWxsIHVuemlwIHB5dGhvbjMtcGlwIG9wZW5qZGstMTEtamRrLWhlYWRsZXNzIGJ1aWxkLWVzc2VudGlhbCBsaWJnbDEtbWVzYS1nbHgnLFxuICAgICAgICAgICAgJ2N1cmwgLXMgaHR0cHM6Ly9kMnM4cDg4dnF1OXc2Ni5jbG91ZGZyb250Lm5ldC9yZWxlYXNlcy9ncmVlbmdyYXNzLW51Y2xldXMtbGF0ZXN0LnppcCA+IGdyZWVuZ3Jhc3MtbnVjbGV1cy1sYXRlc3QuemlwJyxcbiAgICAgICAgICAgICd1bnppcCBncmVlbmdyYXNzLW51Y2xldXMtbGF0ZXN0LnppcCAtZCBHcmVlbmdyYXNzQ29yZSAmJiBybSBncmVlbmdyYXNzLW51Y2xldXMtbGF0ZXN0LnppcCcsXG4gICAgICAgICAgICAnamF2YSAtRHJvb3Q9XCIvZ3JlZW5ncmFzcy92MlwiIC1EbG9nLnN0b3JlPUZJTEUgJyArXG4gICAgICAgICAgICAnICAtamFyIC4vR3JlZW5ncmFzc0NvcmUvbGliL0dyZWVuZ3Jhc3MuamFyICcgK1xuICAgICAgICAgICAgYCAgLS1hd3MtcmVnaW9uICR7U3RhY2sub2YodGhpcykucmVnaW9ufSBgICtcbiAgICAgICAgICAgIGAgIC0tdGhpbmctbmFtZSAke2dnUHJlcmVxdWlzaXRlc0NvbnN0cnVjdC5pb3RUaGluZy50aGluZ05hbWV9IGAgK1xuICAgICAgICAgICAgYCAgLS10ZXMtcm9sZS1uYW1lICR7Z2dQcmVyZXF1aXNpdGVzQ29uc3RydWN0LnRva2VuRXhjaGFuZ2VSb2xlLnJvbGVOYW1lfWAgK1xuICAgICAgICAgICAgYCAgLS10ZXMtcm9sZS1hbGlhcy1uYW1lICAke3Byb3BzLmdnUHJvcHMudG9rZW5FeGNoYW5nZVJvbGVBbGlhc31gICtcbiAgICAgICAgICAgIGAgIC0tdGhpbmctcG9saWN5LW5hbWUgICR7cHJvcHMuZ2dQcm9wcy50aGluZ0lvdFBvbGljeU5hbWV9YCArXG4gICAgICAgICAgICAnICAtLWNvbXBvbmVudC1kZWZhdWx0LXVzZXIgZ2djX3VzZXI6Z2djX2dyb3VwICcgK1xuICAgICAgICAgICAgJyAgLS1wcm92aXNpb24gdHJ1ZSAnICtcbiAgICAgICAgICAgICcgIC0tc2V0dXAtc3lzdGVtLXNlcnZpY2UgdHJ1ZSdcbiAgICAgICAgKTtcblxuICAgICAgICBjb25zdCBpbnN0YW5jZSA9IG5ldyBlYzIuSW5zdGFuY2UodGhpcywgYGdyZWVuZ3Jhc3MtaW5zdGFuY2VgLCB7XG4gICAgICAgICAgICB2cGM6IHZwYyxcbiAgICAgICAgICAgIGluc3RhbmNlVHlwZTogZWMyLkluc3RhbmNlVHlwZS5vZihlYzIuSW5zdGFuY2VDbGFzcy5CVVJTVEFCTEUzX0FNRCwgZWMyLkluc3RhbmNlU2l6ZS5TTUFMTCksXG5cblxuICAgICAgICAgICAgLy8gU2VhcmNoZWQgaW4gbWFya2V0cGxhY2UgZm9yIENhbm9uaWNhbCwgVWJ1bnR1LCAyMC4wNCBMVFMsIGFtZDY0IGZvY2FsIGltYWdlIGJ1aWxkIG9uIDIwMjItMDYtMTBcbiAgICAgICAgICAgIG1hY2hpbmVJbWFnZTogZWMyLk1hY2hpbmVJbWFnZS5nZW5lcmljTGludXgoe1xuICAgICAgICAgICAgICAgICd1cy13ZXN0LTEnOiAnYW1pLTAxMTU0YzhiMmU5YTE0ODg1JyxcbiAgICAgICAgICAgICAgICAndXMtd2VzdC0yJzogJ2FtaS0wZGRmNDI0ZjgxZGRiMDcyMCcsXG4gICAgICAgICAgICAgICAgJ3VzLWVhc3QtMSc6ICdhbWktMDhkNGFjNWI2MzQ1NTNlMTYnLFxuICAgICAgICAgICAgICAgICd1cy1lYXN0LTInOiAnYW1pLTA5NjBhYjY3MGM4YmI0NWYzJyxcbiAgICAgICAgICAgICAgICAnZXUtd2VzdC0xJzogJ2FtaS0wZDJhNGE1ZDY5ZTQ2ZWEwYicsXG4gICAgICAgICAgICAgICAgJ2V1LXdlc3QtMic6ICdhbWktMGJkMjA5OTMzOGJjNTVlNmQnLFxuICAgICAgICAgICAgICAgICdldS1jZW50cmFsLTEnOiAnYW1pLTBjOTM1NDM4OGJiMzZjMDg4JyxcbiAgICAgICAgICAgICAgICAnYXAtc291dGhlYXN0LTEnOiAnYW1pLTA0ZmY5ZTliNTFjMWY2MmNhJyxcbiAgICAgICAgICAgICAgICAnYXAtc291dGhlYXN0LTInOiAnYW1pLTAzMDBkYzAzYzEzZWI3NjYwJyxcbiAgICAgICAgICAgICAgICAnYXAtc291dGgtMSc6ICdhbWktMDA2ZDM5OTVkM2E2Yjk2M2InLFxuICAgICAgICAgICAgICAgICdhcC1ub3J0aGVhc3QtMSc6ICdhbWktMGY4MDQ4ZmEzZTNiOWU4ZmYnLFxuICAgICAgICAgICAgICAgICdhcC1ub3J0aGVhc3QtMic6ICdhbWktMGVhNWViNGIwNTY0NWFhOGEnLFxuICAgICAgICAgICAgICAgICdjYS1jZW50cmFsLTEnOiAnYW1pLTA2NjVjZTU3ZDE3MmU3MTJlJyxcbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIHJvbGU6IGluc3RhbmNlUm9sZSxcbiAgICAgICAgICAgIGluc3RhbmNlTmFtZTogYEdyZWVuZ3Jhc3MtJHtTdGFjay5vZih0aGlzKS5zdGFja05hbWV9YCxcbiAgICAgICAgICAgIHVzZXJEYXRhOiB1c2VyZGF0YSxcbiAgICAgICAgICAgIGJsb2NrRGV2aWNlczogW3tcbiAgICAgICAgICAgICAgICBkZXZpY2VOYW1lOiAnL2Rldi9zZGExJyxcbiAgICAgICAgICAgICAgICB2b2x1bWU6IGVjMi5CbG9ja0RldmljZVZvbHVtZS5lYnMoMzAsIHtcbiAgICAgICAgICAgICAgICAgICAgZW5jcnlwdGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICB2b2x1bWVUeXBlOiBlYzIuRWJzRGV2aWNlVm9sdW1lVHlwZS5HUDMsXG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZU9uVGVybWluYXRpb246IHRydWVcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfV1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgaW5zdGFuY2Uubm9kZS5hZGREZXBlbmRlbmN5KGdnUHJlcmVxdWlzaXRlc0NvbnN0cnVjdCk7XG4gICAgfVxufVxuIl19