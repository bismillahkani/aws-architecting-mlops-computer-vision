import { aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AppConfig } from '../../bin/app';
export interface GgOnEc2ConstructProps {
    thingIotPolicyName: string;
    allowAssumeTokenExchangeRolePolicyName: string;
    tokenExchangeRoleAlias: string;
    deviceFleetName: string;
    iotThingName: string;
    pipelineAssetsPrefix: string;
    repoName: string;
    branchName: string;
}
export declare class GgOnEc2Construct extends Construct {
    readonly deviceRole: iam.Role;
    readonly iotThingName: string;
    constructor(scope: Construct, id: string, props: AppConfig);
}
