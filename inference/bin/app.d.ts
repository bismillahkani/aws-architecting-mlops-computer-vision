#!/usr/bin/env node
import { StackProps } from 'aws-cdk-lib';
import 'source-map-support/register';
export interface AppConfig extends StackProps {
    readonly repoType: string;
    readonly repoName: string;
    readonly branchName: string;
    readonly githubConnectionArn: string;
    readonly githubRepoOwner: string;
    readonly pipelinePrefix: string;
    readonly assetsBucket: string;
    readonly ggProps: {
        readonly thingIotPolicyName: string;
        readonly tokenExchangeRoleAlias: string;
        readonly allowAssumeTokenExchangeRolePolicyName: string;
        readonly iotThingName: string;
    };
    readonly deploymentProps: {
        readonly smModelPackageGroupName: string;
        readonly ggModelComponentName: string;
        readonly ggInferenceComponentName: string;
    };
}
