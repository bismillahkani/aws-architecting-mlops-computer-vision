import { aws_iam as iam, aws_iot as iot } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AppConfig } from '../../bin/app';
export interface GgRequirementConstructProps {
    thingIotPolicyName: string;
    tokenExchangeRoleAlias: string;
    allowAssumeTokenExchangeRolePolicyName: string;
    thingName: string;
}
export declare class GgPrerequisitesConstruct extends Construct {
    readonly iotThing: iot.CfnThing;
    readonly tokenExchangeRole: iam.Role;
    constructor(scope: Construct, id: string, props: AppConfig);
}
