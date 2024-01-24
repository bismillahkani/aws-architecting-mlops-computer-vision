#!/usr/bin/env node
import { StackProps } from 'aws-cdk-lib';
import 'source-map-support/register';
export interface AppConfig extends StackProps {
    readonly repoType: string;
    readonly repoName: string;
    readonly branchName: string;
    readonly featureGroupName: string;
    readonly modelPackageGroupName: string;
    readonly modelPackageGroupDescription: string;
}
