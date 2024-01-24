#!/usr/bin/env node
import { StackProps } from 'aws-cdk-lib';
import 'source-map-support/register';
export interface AppConfig extends StackProps {
    readonly repoType: string;
    readonly repoName: string;
    readonly branchName: string;
    readonly githubConnectionArn: string;
    readonly githubRepoOwner: string;
    readonly pipelineAssetsPrefix: string;
    readonly usePrivateWorkteamForLabeling: boolean;
    readonly usePrivateWorkteamForVerification: boolean;
    readonly labelingJobPrivateWorkteamArn: string;
    readonly verificationJobPrivateWorkteamArn: string;
    readonly maxLabelsPerLabelingJob: number;
    readonly labelingPipelineSchedule: string;
    readonly featureGroupName: string;
    readonly assetsBucket: string;
}
