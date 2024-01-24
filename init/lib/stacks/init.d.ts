import { aws_iam as iam, aws_s3 as s3, aws_s3_deployment as s3deploy, aws_sagemaker as sagemaker, CfnOutput, Stack } from 'aws-cdk-lib';
import { Role } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { AppConfig } from '../../bin/app';
export declare class LabelingInitStack extends Stack {
    readonly dataBucket: s3.Bucket;
    readonly dataBucketOutput: CfnOutput;
    readonly modelPackageGroup: sagemaker.CfnModelPackageGroup;
    readonly featureGroup: sagemaker.CfnFeatureGroup;
    constructor(scope: Construct, id: string, props: AppConfig);
    seedCodeCommitRepo(repoName: string, branchName: string): void;
    createAssetsBucket(): s3.Bucket;
    seedInitialAssetsToBucket(dataBucket: s3.Bucket): s3deploy.BucketDeployment;
    createSeedAssetsRole(): iam.Role;
    private readonly _featureGroupName;
    seed_labels_to_feature_store(role: Role, dataBucket: Bucket, bucketDeployment: s3deploy.BucketDeployment, props: AppConfig): sagemaker.CfnFeatureGroup;
    createModelPackageGroup(props: AppConfig): sagemaker.CfnModelPackageGroup;
}
