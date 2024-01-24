"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabelingInitStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_iam_1 = require("aws-cdk-lib/aws-iam");
const aws_lambda_1 = require("aws-cdk-lib/aws-lambda");
const path = require("path");
const cdk_nag_1 = require("cdk-nag");
class LabelingInitStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        this._featureGroupName = 'tag-quality-inspection';
        if (props.repoType == "CODECOMMIT") {
            this.seedCodeCommitRepo(props.repoName, props.branchName);
        }
        this.dataBucket = this.createAssetsBucket();
        const seedAssetsRole = this.createSeedAssetsRole();
        const bucketDeployment = this.seedInitialAssetsToBucket(this.dataBucket);
        this.featureGroup = this.seed_labels_to_feature_store(seedAssetsRole, this.dataBucket, bucketDeployment, props);
        this.modelPackageGroup = this.createModelPackageGroup(props);
        new aws_cdk_lib_1.CfnOutput(this, 'modelPackageGroup', {
            value: this.modelPackageGroup.modelPackageGroupName,
            description: 'The name of the modelpackage group where models are stored in sagemaker model registry',
            exportName: 'mlopsModelPackageGroup'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'mlopsfeatureGroup', {
            value: this.featureGroup.featureGroupName,
            description: 'The name of the feature group where features are stored in feature store',
            exportName: 'mlopsfeatureGroup'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'mlopsDataBucket', {
            value: this.dataBucket.bucketName,
            description: 'The Name of the data bucket',
            exportName: 'mlopsDataBucket'
        });
    }
    seedCodeCommitRepo(repoName, branchName) {
        //only uploading minimal code from this repo for the stack to work, excluding seed assets and doc
        const directoryAsset = new aws_cdk_lib_1.aws_s3_assets.Asset(this, "SeedCodeAsset", {
            path: path.join(__dirname, "../../.."),
            exclude: ['*.js', 'node_modules', 'doc', '*.d.ts', 'cdk.out', 'model.tar.gz', '.git', '.python-version', '*.pt', '*.onnx', '*.jpg', 'inference-sm', 'inference-cloud']
        });
        const repo = new aws_cdk_lib_1.aws_codecommit.Repository(this, 'Repository', {
            repositoryName: repoName,
            code: aws_cdk_lib_1.aws_codecommit.Code.fromAsset(directoryAsset, branchName)
        });
    }
    createAssetsBucket() {
        // create default bucker where all assets are stored
        const dataBucket = new aws_cdk_lib_1.aws_s3.Bucket(this, 'LabelingDataBucket', {
            publicReadAccess: false,
            blockPublicAccess: aws_cdk_lib_1.aws_s3.BlockPublicAccess.BLOCK_ALL,
            cors: [{
                    allowedHeaders: [],
                    allowedMethods: [aws_cdk_lib_1.aws_s3.HttpMethods.GET],
                    allowedOrigins: ['*'],
                }],
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            encryption: aws_cdk_lib_1.aws_s3.BucketEncryption.S3_MANAGED,
        });
        cdk_nag_1.NagSuppressions.addResourceSuppressions(dataBucket, [{ id: 'AwsSolutions-S1', reason: 'Artifact Bucket does not need access logs enabled for sample' }]);
        // Bucket policy to deny access to HTTP requests
        const myBucketPolicy = new aws_cdk_lib_1.aws_iam.PolicyStatement({
            effect: aws_cdk_lib_1.aws_iam.Effect.DENY,
            actions: ["s3:*"],
            resources: [dataBucket.bucketArn, dataBucket.arnForObjects("*")],
            principals: [new aws_cdk_lib_1.aws_iam.AnyPrincipal()],
            conditions: { "Bool": { "aws:SecureTransport": false } }
        });
        // Allow Cfn exec and deploy permissions
        const cfnBucketPolicy = new aws_cdk_lib_1.aws_iam.PolicyStatement({
            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
            actions: ["s3:*"],
            resources: [dataBucket.bucketArn, dataBucket.arnForObjects("*")],
            principals: [new aws_iam_1.ServicePrincipal('cloudformation.amazonaws.com')]
        });
        // Allow cdk roles to read/write permissions
        const cdkBucketPolicy = new aws_cdk_lib_1.aws_iam.PolicyStatement({
            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
            actions: ["s3:*"],
            resources: [dataBucket.bucketArn, dataBucket.arnForObjects("*")],
            principals: [new aws_cdk_lib_1.aws_iam.ArnPrincipal(`arn:aws:iam::${aws_cdk_lib_1.Stack.of(this).account}:role/cdk-hnb659fds-deploy-role-${aws_cdk_lib_1.Stack.of(this).account}-${aws_cdk_lib_1.Stack.of(this).region}`)]
        });
        dataBucket.addToResourcePolicy(myBucketPolicy);
        dataBucket.addToResourcePolicy(cfnBucketPolicy);
        dataBucket.addToResourcePolicy(cdkBucketPolicy);
        return dataBucket;
    }
    seedInitialAssetsToBucket(dataBucket) {
        // deploy assets required by the pipeline, like the dataset and templates for labeling jobs
        return new aws_cdk_lib_1.aws_s3_deployment.BucketDeployment(this, 'AssetInit', {
            memoryLimit: 1024,
            sources: [aws_cdk_lib_1.aws_s3_deployment.Source.asset(path.join('./lib/assets'))],
            destinationBucket: dataBucket,
            destinationKeyPrefix: 'pipeline/assets',
        });
    }
    createSeedAssetsRole() {
        const policy = new aws_iam_1.PolicyDocument({
            statements: [
                new aws_iam_1.PolicyStatement({
                    resources: [`arn:aws:s3:::${this.dataBucket.bucketName}/*`, `arn:aws:s3:::${this.dataBucket.bucketName}`],
                    actions: ['s3:*']
                }),
                new aws_iam_1.PolicyStatement({
                    actions: ['sagemaker:PutRecord'],
                    resources: [`arn:aws:sagemaker:${this.region}:${this.account}:feature-group/${this._featureGroupName}`]
                }),
                new aws_iam_1.PolicyStatement({
                    actions: ['ecr:BatchGetImage',
                        'ecr:GetDownloadUrlForLayer'
                    ],
                    resources: [`arn:aws:ecr:${this.region}:${this.account}:repository/${aws_cdk_lib_1.DefaultStackSynthesizer.DEFAULT_IMAGE_ASSETS_REPOSITORY_NAME}`]
                }),
                new aws_iam_1.PolicyStatement({
                    actions: ['ecr:GetAuthorizationToken'],
                    resources: ['*']
                })
            ]
        });
        return new aws_iam_1.Role(this, 'FeatureGroupRole', {
            assumedBy: new aws_iam_1.CompositePrincipal(new aws_iam_1.ServicePrincipal('sagemaker.amazonaws.com'), new aws_iam_1.ServicePrincipal('lambda.amazonaws.com')),
            inlinePolicies: {
                lambdaPolicy: policy
            },
            managedPolicies: [
                aws_iam_1.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFeatureStoreAccess'),
                aws_iam_1.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
            ]
        });
    }
    seed_labels_to_feature_store(role, dataBucket, bucketDeployment, props) {
        const offlineStoreConfig = {
            "S3StorageConfig": {
                "S3Uri": `s3://${dataBucket.bucketName}/feature-store/`
            }
        };
        const featureGroup = new aws_cdk_lib_1.aws_sagemaker.CfnFeatureGroup(this, 'MyCfnFeatureGroup', {
            eventTimeFeatureName: 'event_time',
            featureDefinitions: [{
                    featureName: 'source_ref',
                    featureType: 'String',
                },
                {
                    featureName: 'image_width',
                    featureType: 'Integral',
                },
                {
                    featureName: 'image_height',
                    featureType: 'Integral',
                },
                {
                    featureName: 'image_depth',
                    featureType: 'Integral',
                },
                {
                    featureName: 'annotations',
                    featureType: 'String',
                },
                {
                    featureName: 'event_time',
                    featureType: 'Fractional',
                },
                {
                    featureName: 'labeling_job',
                    featureType: 'String',
                },
                {
                    featureName: 'status',
                    featureType: 'String',
                }
            ],
            featureGroupName: this._featureGroupName,
            recordIdentifierFeatureName: 'source_ref',
            description: 'Stores bounding box dataset for quality inspection',
            offlineStoreConfig: offlineStoreConfig,
            roleArn: role.roleArn,
        });
        const seedLabelsFunction = new aws_lambda_1.DockerImageFunction(this, 'SeedLabelsToFeatureStoreFunction', {
            code: aws_lambda_1.DockerImageCode.fromImageAsset(path.join(__dirname, '../lambda/seed_labels_to_feature_store')),
            architecture: aws_lambda_1.Architecture.X86_64,
            functionName: "SeedLabelsToFeatureStoreFunction",
            memorySize: 1024,
            role: role,
            timeout: aws_cdk_lib_1.Duration.seconds(300),
            logRetention: aws_cdk_lib_1.aws_logs.RetentionDays.ONE_WEEK,
        });
        const customResource = new aws_cdk_lib_1.CustomResource(this, 'SeedLabelsCustomResource', {
            serviceToken: seedLabelsFunction.functionArn,
            properties: {
                feature_group_name: props.featureGroupName,
                labels_uri: `s3://${dataBucket.bucketName}/pipeline/assets/labels/labels.csv`
            }
        });
        featureGroup.node.addDependency(bucketDeployment);
        customResource.node.addDependency(featureGroup);
        return featureGroup;
    }
    createModelPackageGroup(props) {
        const cfnModelPackageGroup = new aws_cdk_lib_1.aws_sagemaker.CfnModelPackageGroup(this, 'MyCfnModelPackageGroup', {
            modelPackageGroupName: props.modelPackageGroupName,
            modelPackageGroupDescription: props.modelPackageGroupDescription,
        });
        cfnModelPackageGroup.applyRemovalPolicy(aws_cdk_lib_1.RemovalPolicy.DESTROY);
        return cfnModelPackageGroup;
    }
}
exports.LabelingInitStack = LabelingInitStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5pdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImluaXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsNkNBZXFCO0FBQ3JCLGlEQUFpSTtBQUNqSSx1REFBNEY7QUFHNUYsNkJBQTZCO0FBRTdCLHFDQUF3QztBQUN4QyxNQUFhLGlCQUFrQixTQUFRLG1CQUFLO0lBT3hDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0I7UUFDdEQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFrSlgsc0JBQWlCLEdBQUcsd0JBQXdCLENBQUM7UUFoSjFELElBQUksS0FBSyxDQUFDLFFBQVEsSUFBSSxZQUFZLEVBQUM7WUFDL0IsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFBO1NBQzVEO1FBQ0QsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQTtRQUMzQyxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQTtRQUNsRCxNQUFNLGdCQUFnQixHQUE4QixJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFBO1FBQ25HLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLDRCQUE0QixDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFLGdCQUFnQixFQUFFLEtBQUssQ0FBQyxDQUFBO1FBQy9HLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDLENBQUE7UUFFNUQsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUNyQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLHFCQUFxQjtZQUNuRCxXQUFXLEVBQUUsd0ZBQXdGO1lBQ3JHLFVBQVUsRUFBRSx3QkFB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LENBQUM7UUFDaEQsT0FBTyxZQUFZLENBQUE7SUFDdkIsQ0FBQztJQUVELHVCQUF1QixDQUFDLEtBQWdCO1FBRXBDLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSwyQkFBUyxDQUFDLG9CQUFvQixDQUFDLElBQUksRUFBRSx3QkFBd0IsRUFBRTtZQUM1RixxQkFBcUIsRUFBRSxLQUFLLENBQUMscUJBQXFCO1lBQ2xELDRCQUE0QixFQUFFLEtBQUssQ0FBQyw0QkFBNEI7U0FDbkUsQ0FBQyxDQUFDO1FBRUgsb0JBQW9CLENBQUMsa0JBQWtCLENBQUMsMkJBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQTtRQUM5RCxPQUFPLG9CQUFvQixDQUFBO0lBQy9CLENBQUM7Q0FDSjtBQWhQRCw4Q0FnUEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBsYW1iZGFfcHl0aG9uIGZyb20gJ0Bhd3MtY2RrL2F3cy1sYW1iZGEtcHl0aG9uLWFscGhhJztcbmltcG9ydCB7XG4gICAgYXdzX2xhbWJkYSBhcyBsYW1iZGEsXG4gICAgYXdzX2xvZ3MgYXMgbG9ncyxcbiAgICBhd3NfaWFtIGFzIGlhbSxcbiAgICBhd3NfczMgYXMgczMsXG4gICAgYXdzX3MzX2Fzc2V0cyBhcyBzM19hc3NldHMsXG4gICAgYXdzX2NvZGVjb21taXQgYXMgY29kZWNvbW1pdCxcbiAgICBhd3NfczNfZGVwbG95bWVudCBhcyBzM2RlcGxveSxcbiAgICBhd3Nfc2FnZW1ha2VyIGFzIHNhZ2VtYWtlcixcbiAgICBDZm5PdXRwdXQsXG4gICAgQ3VzdG9tUmVzb3VyY2UsXG4gICAgRHVyYXRpb24sXG4gICAgUmVtb3ZhbFBvbGljeSxcbiAgICBTdGFjayxcbiAgICBEZWZhdWx0U3RhY2tTeW50aGVzaXplclxufSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb21wb3NpdGVQcmluY2lwYWwsIE1hbmFnZWRQb2xpY3ksIFBvbGljeURvY3VtZW50LCBQb2xpY3lTdGF0ZW1lbnQsIFJvbGUsIFNlcnZpY2VQcmluY2lwYWwgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IEFyY2hpdGVjdHVyZSwgRG9ja2VySW1hZ2VDb2RlLCBEb2NrZXJJbWFnZUZ1bmN0aW9uIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgeyBCdWNrZXQgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgeyBBcHBDb25maWcgfSBmcm9tICcuLi8uLi9iaW4vYXBwJztcbmltcG9ydCB7TmFnU3VwcHJlc3Npb25zfSBmcm9tIFwiY2RrLW5hZ1wiO1xuZXhwb3J0IGNsYXNzIExhYmVsaW5nSW5pdFN0YWNrIGV4dGVuZHMgU3RhY2sge1xuXG4gICAgcmVhZG9ubHkgZGF0YUJ1Y2tldDogczMuQnVja2V0O1xuICAgIHJlYWRvbmx5IGRhdGFCdWNrZXRPdXRwdXQ6IENmbk91dHB1dDtcbiAgICByZWFkb25seSBtb2RlbFBhY2thZ2VHcm91cDogc2FnZW1ha2VyLkNmbk1vZGVsUGFja2FnZUdyb3VwO1xuICAgIHJlYWRvbmx5IGZlYXR1cmVHcm91cDogc2FnZW1ha2VyLkNmbkZlYXR1cmVHcm91cDtcblxuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBcHBDb25maWcpIHtcbiAgICAgICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAgICAgaWYgKHByb3BzLnJlcG9UeXBlID09IFwiQ09ERUNPTU1JVFwiKXtcbiAgICAgICAgICAgIHRoaXMuc2VlZENvZGVDb21taXRSZXBvKHByb3BzLnJlcG9OYW1lLCBwcm9wcy5icmFuY2hOYW1lKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuZGF0YUJ1Y2tldCA9IHRoaXMuY3JlYXRlQXNzZXRzQnVja2V0KClcbiAgICAgICAgY29uc3Qgc2VlZEFzc2V0c1JvbGUgPSB0aGlzLmNyZWF0ZVNlZWRBc3NldHNSb2xlKClcbiAgICAgICAgY29uc3QgYnVja2V0RGVwbG95bWVudDogczNkZXBsb3kuQnVja2V0RGVwbG95bWVudCA9IHRoaXMuc2VlZEluaXRpYWxBc3NldHNUb0J1Y2tldCh0aGlzLmRhdGFCdWNrZXQpXG4gICAgICAgIHRoaXMuZmVhdHVyZUdyb3VwID0gdGhpcy5zZWVkX2xhYmVsc190b19mZWF0dXJlX3N0b3JlKHNlZWRBc3NldHNSb2xlLCB0aGlzLmRhdGFCdWNrZXQsIGJ1Y2tldERlcGxveW1lbnQsIHByb3BzKVxuICAgICAgICB0aGlzLm1vZGVsUGFja2FnZUdyb3VwID0gdGhpcy5jcmVhdGVNb2RlbFBhY2thZ2VHcm91cChwcm9wcylcblxuICAgICAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdtb2RlbFBhY2thZ2VHcm91cCcsIHtcbiAgICAgICAgICAgIHZhbHVlOiB0aGlzLm1vZGVsUGFja2FnZUdyb3VwLm1vZGVsUGFja2FnZUdyb3VwTmFtZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVGhlIG5hbWUgb2YgdGhlIG1vZGVscGFja2FnZSBncm91cCB3aGVyZSBtb2RlbHMgYXJlIHN0b3JlZCBpbiBzYWdlbWFrZXIgbW9kZWwgcmVnaXN0cnknLFxuICAgICAgICAgICAgZXhwb3J0TmFtZTogJ21sb3BzTW9kZWxQYWNrYWdlR3JvdXAnXG4gICAgICAgIH0pXG5cblxuICAgICAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdtbG9wc2ZlYXR1cmVHcm91cCcsIHtcbiAgICAgICAgICAgIHZhbHVlOiB0aGlzLmZlYXR1cmVHcm91cC5mZWF0dXJlR3JvdXBOYW1lLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICdUaGUgbmFtZSBvZiB0aGUgZmVhdHVyZSBncm91cCB3aGVyZSBmZWF0dXJlcyBhcmUgc3RvcmVkIGluIGZlYXR1cmUgc3RvcmUnLFxuICAgICAgICAgICAgZXhwb3J0TmFtZTogJ21sb3BzZmVhdHVyZUdyb3VwJ1xuICAgICAgICB9KVxuXG4gICAgICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ21sb3BzRGF0YUJ1Y2tldCcsIHtcbiAgICAgICAgICAgIHZhbHVlOiB0aGlzLmRhdGFCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVGhlIE5hbWUgb2YgdGhlIGRhdGEgYnVja2V0JyxcbiAgICAgICAgICAgIGV4cG9ydE5hbWU6ICdtbG9wc0RhdGFCdWNrZXQnXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgc2VlZENvZGVDb21taXRSZXBvKHJlcG9OYW1lOiBzdHJpbmcsIGJyYW5jaE5hbWU6IHN0cmluZykge1xuXG4gICAgICAgIC8vb25seSB1cGxvYWRpbmcgbWluaW1hbCBjb2RlIGZyb20gdGhpcyByZXBvIGZvciB0aGUgc3RhY2sgdG8gd29yaywgZXhjbHVkaW5nIHNlZWQgYXNzZXRzIGFuZCBkb2NcbiAgICAgICAgY29uc3QgZGlyZWN0b3J5QXNzZXQgPSBuZXcgczNfYXNzZXRzLkFzc2V0KHRoaXMsIFwiU2VlZENvZGVBc3NldFwiLCB7XG4gICAgICAgICAgICBwYXRoOiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uLy4uLy4uXCIpLFxuICAgICAgICAgICAgZXhjbHVkZTogWycqLmpzJywgJ25vZGVfbW9kdWxlcycsICdkb2MnLCAnKi5kLnRzJywgJ2Nkay5vdXQnLCAnbW9kZWwudGFyLmd6JywgJy5naXQnLCAnLnB5dGhvbi12ZXJzaW9uJywgJyoucHQnLCAnKi5vbm54JywgJyouanBnJywgJ2luZmVyZW5jZS1zbScsICdpbmZlcmVuY2UtY2xvdWQnXVxuXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCByZXBvID0gbmV3IGNvZGVjb21taXQuUmVwb3NpdG9yeSh0aGlzLCAnUmVwb3NpdG9yeScsIHtcbiAgICAgICAgICAgIHJlcG9zaXRvcnlOYW1lOiByZXBvTmFtZSxcbiAgICAgICAgICAgIGNvZGU6IGNvZGVjb21taXQuQ29kZS5mcm9tQXNzZXQoZGlyZWN0b3J5QXNzZXQsIGJyYW5jaE5hbWUpXG4gICAgICAgIH0pXG4gICAgfVxuICAgIGNyZWF0ZUFzc2V0c0J1Y2tldCgpIHtcbiAgICAgICAgLy8gY3JlYXRlIGRlZmF1bHQgYnVja2VyIHdoZXJlIGFsbCBhc3NldHMgYXJlIHN0b3JlZFxuICAgICAgICBjb25zdCBkYXRhQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnTGFiZWxpbmdEYXRhQnVja2V0Jywge1xuICAgICAgICAgICAgcHVibGljUmVhZEFjY2VzczogZmFsc2UsXG4gICAgICAgICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgICAgICAgY29yczogW3tcbiAgICAgICAgICAgICAgICBhbGxvd2VkSGVhZGVyczogW10sXG4gICAgICAgICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtzMy5IdHRwTWV0aG9kcy5HRVRdLFxuICAgICAgICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgICAgIH1dLFxuICAgICAgICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXG4gICAgICAgICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIE5hZ1N1cHByZXNzaW9ucy5hZGRSZXNvdXJjZVN1cHByZXNzaW9ucyggZGF0YUJ1Y2tldCwgW3sgaWQ6ICdBd3NTb2x1dGlvbnMtUzEnLCByZWFzb246ICdBcnRpZmFjdCBCdWNrZXQgZG9lcyBub3QgbmVlZCBhY2Nlc3MgbG9ncyBlbmFibGVkIGZvciBzYW1wbGUnfV0pXG5cbiAgICAgICAgLy8gQnVja2V0IHBvbGljeSB0byBkZW55IGFjY2VzcyB0byBIVFRQIHJlcXVlc3RzXG4gICAgICAgIGNvbnN0IG15QnVja2V0UG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkRFTlksXG4gICAgICAgICAgICBhY3Rpb25zOiBbXCJzMzoqXCJdLFxuICAgICAgICAgICAgcmVzb3VyY2VzOiBbZGF0YUJ1Y2tldC5idWNrZXRBcm4sIGRhdGFCdWNrZXQuYXJuRm9yT2JqZWN0cyhcIipcIildLFxuICAgICAgICAgICAgcHJpbmNpcGFsczogW25ldyBpYW0uQW55UHJpbmNpcGFsKCldLFxuICAgICAgICAgICAgY29uZGl0aW9uczogeyBcIkJvb2xcIjogeyBcImF3czpTZWN1cmVUcmFuc3BvcnRcIjogZmFsc2UgfSB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFsbG93IENmbiBleGVjIGFuZCBkZXBsb3kgcGVybWlzc2lvbnNcbiAgICAgICAgY29uc3QgY2ZuQnVja2V0UG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgYWN0aW9uczogW1wiczM6KlwiXSxcbiAgICAgICAgICAgIHJlc291cmNlczogW2RhdGFCdWNrZXQuYnVja2V0QXJuLCBkYXRhQnVja2V0LmFybkZvck9iamVjdHMoXCIqXCIpXSxcbiAgICAgICAgICAgIHByaW5jaXBhbHM6IFtuZXcgU2VydmljZVByaW5jaXBhbCgnY2xvdWRmb3JtYXRpb24uYW1hem9uYXdzLmNvbScpXVxuICAgICAgICB9KVxuXG4gICAgICAgIC8vIEFsbG93IGNkayByb2xlcyB0byByZWFkL3dyaXRlIHBlcm1pc3Npb25zXG4gICAgICAgIGNvbnN0IGNka0J1Y2tldFBvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcInMzOipcIl0sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFtkYXRhQnVja2V0LmJ1Y2tldEFybiwgZGF0YUJ1Y2tldC5hcm5Gb3JPYmplY3RzKFwiKlwiKV0sXG4gICAgICAgICAgICBwcmluY2lwYWxzOiBbbmV3IGlhbS5Bcm5QcmluY2lwYWwoXG4gICAgICAgICAgICAgICAgYGFybjphd3M6aWFtOjoke1N0YWNrLm9mKHRoaXMpLmFjY291bnR9OnJvbGUvY2RrLWhuYjY1OWZkcy1kZXBsb3ktcm9sZS0ke1N0YWNrLm9mKHRoaXMpLmFjY291bnR9LSR7U3RhY2sub2YodGhpcykucmVnaW9ufWBcbiAgICAgICAgICAgICAgKV1cbiAgICAgICAgfSlcblxuICAgICAgICBkYXRhQnVja2V0LmFkZFRvUmVzb3VyY2VQb2xpY3kobXlCdWNrZXRQb2xpY3kpO1xuICAgICAgICBkYXRhQnVja2V0LmFkZFRvUmVzb3VyY2VQb2xpY3koY2ZuQnVja2V0UG9saWN5KTtcbiAgICAgICAgZGF0YUJ1Y2tldC5hZGRUb1Jlc291cmNlUG9saWN5KGNka0J1Y2tldFBvbGljeSk7XG5cbiAgICAgICAgcmV0dXJuIGRhdGFCdWNrZXRcbiAgICB9XG5cbiAgICBzZWVkSW5pdGlhbEFzc2V0c1RvQnVja2V0KGRhdGFCdWNrZXQ6IHMzLkJ1Y2tldCkge1xuICAgICAgICAvLyBkZXBsb3kgYXNzZXRzIHJlcXVpcmVkIGJ5IHRoZSBwaXBlbGluZSwgbGlrZSB0aGUgZGF0YXNldCBhbmQgdGVtcGxhdGVzIGZvciBsYWJlbGluZyBqb2JzXG4gICAgICAgIHJldHVybiBuZXcgczNkZXBsb3kuQnVja2V0RGVwbG95bWVudCh0aGlzLCAnQXNzZXRJbml0Jywge1xuICAgICAgICAgICAgbWVtb3J5TGltaXQ6IDEwMjQsXG4gICAgICAgICAgICBzb3VyY2VzOiBbczNkZXBsb3kuU291cmNlLmFzc2V0KHBhdGguam9pbignLi9saWIvYXNzZXRzJykpXSxcbiAgICAgICAgICAgIGRlc3RpbmF0aW9uQnVja2V0OiBkYXRhQnVja2V0LFxuICAgICAgICAgICAgZGVzdGluYXRpb25LZXlQcmVmaXg6ICdwaXBlbGluZS9hc3NldHMnLFxuXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGNyZWF0ZVNlZWRBc3NldHNSb2xlKCkge1xuXG4gICAgICAgIGNvbnN0IHBvbGljeSA9IG5ldyBQb2xpY3lEb2N1bWVudCh7XG4gICAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOnMzOjo6JHt0aGlzLmRhdGFCdWNrZXQuYnVja2V0TmFtZX0vKmAsIGBhcm46YXdzOnMzOjo6JHt0aGlzLmRhdGFCdWNrZXQuYnVja2V0TmFtZX1gXSxcbiAgICAgICAgICAgICAgICAgICAgYWN0aW9uczogWydzMzoqJ11cbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICAgICAgYWN0aW9uczogWydzYWdlbWFrZXI6UHV0UmVjb3JkJ10sXG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOnNhZ2VtYWtlcjoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06ZmVhdHVyZS1ncm91cC8ke3RoaXMuX2ZlYXR1cmVHcm91cE5hbWV9YF1cbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICAgICAgYWN0aW9uczogWydlY3I6QmF0Y2hHZXRJbWFnZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAnZWNyOkdldERvd25sb2FkVXJsRm9yTGF5ZXInXG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOmVjcjoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06cmVwb3NpdG9yeS8ke0RlZmF1bHRTdGFja1N5bnRoZXNpemVyLkRFRkFVTFRfSU1BR0VfQVNTRVRTX1JFUE9TSVRPUllfTkFNRX1gXVxuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICAgICAgICBhY3Rpb25zOiBbJ2VjcjpHZXRBdXRob3JpemF0aW9uVG9rZW4nXSxcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBdXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBuZXcgUm9sZSh0aGlzLCAnRmVhdHVyZUdyb3VwUm9sZScsIHtcbiAgICAgICAgICAgIGFzc3VtZWRCeTogbmV3IENvbXBvc2l0ZVByaW5jaXBhbChcbiAgICAgICAgICAgICAgICBuZXcgU2VydmljZVByaW5jaXBhbCgnc2FnZW1ha2VyLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgICAgICAgICAgICBuZXcgU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKVxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIGlubGluZVBvbGljaWVzOiB7XG4gICAgICAgICAgICAgICAgbGFtYmRhUG9saWN5OiBwb2xpY3lcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgICAgICAgICBNYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnQW1hem9uU2FnZU1ha2VyRmVhdHVyZVN0b3JlQWNjZXNzJyksXG4gICAgICAgICAgICAgICAgTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKVxuICAgICAgICAgICAgXVxuICAgICAgICB9KVxuICAgIH1cblxuICAgIHByaXZhdGUgcmVhZG9ubHkgX2ZlYXR1cmVHcm91cE5hbWUgPSAndGFnLXF1YWxpdHktaW5zcGVjdGlvbic7XG5cbiAgICBzZWVkX2xhYmVsc190b19mZWF0dXJlX3N0b3JlKHJvbGU6IFJvbGUsIGRhdGFCdWNrZXQ6IEJ1Y2tldCwgYnVja2V0RGVwbG95bWVudDogczNkZXBsb3kuQnVja2V0RGVwbG95bWVudCwgcHJvcHM6IEFwcENvbmZpZykge1xuXG4gICAgICAgIGNvbnN0IG9mZmxpbmVTdG9yZUNvbmZpZzogYW55ID0ge1xuICAgICAgICAgICAgXCJTM1N0b3JhZ2VDb25maWdcIjoge1xuICAgICAgICAgICAgICAgIFwiUzNVcmlcIjogYHMzOi8vJHtkYXRhQnVja2V0LmJ1Y2tldE5hbWV9L2ZlYXR1cmUtc3RvcmUvYFxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGZlYXR1cmVHcm91cCA9IG5ldyBzYWdlbWFrZXIuQ2ZuRmVhdHVyZUdyb3VwKHRoaXMsICdNeUNmbkZlYXR1cmVHcm91cCcsIHtcbiAgICAgICAgICAgIGV2ZW50VGltZUZlYXR1cmVOYW1lOiAnZXZlbnRfdGltZScsXG4gICAgICAgICAgICBmZWF0dXJlRGVmaW5pdGlvbnM6IFt7XG4gICAgICAgICAgICAgICAgZmVhdHVyZU5hbWU6ICdzb3VyY2VfcmVmJyxcbiAgICAgICAgICAgICAgICBmZWF0dXJlVHlwZTogJ1N0cmluZycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGZlYXR1cmVOYW1lOiAnaW1hZ2Vfd2lkdGgnLFxuICAgICAgICAgICAgICAgIGZlYXR1cmVUeXBlOiAnSW50ZWdyYWwnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBmZWF0dXJlTmFtZTogJ2ltYWdlX2hlaWdodCcsXG4gICAgICAgICAgICAgICAgZmVhdHVyZVR5cGU6ICdJbnRlZ3JhbCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGZlYXR1cmVOYW1lOiAnaW1hZ2VfZGVwdGgnLFxuICAgICAgICAgICAgICAgIGZlYXR1cmVUeXBlOiAnSW50ZWdyYWwnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBmZWF0dXJlTmFtZTogJ2Fubm90YXRpb25zJyxcbiAgICAgICAgICAgICAgICBmZWF0dXJlVHlwZTogJ1N0cmluZycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGZlYXR1cmVOYW1lOiAnZXZlbnRfdGltZScsXG4gICAgICAgICAgICAgICAgZmVhdHVyZVR5cGU6ICdGcmFjdGlvbmFsJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZmVhdHVyZU5hbWU6ICdsYWJlbGluZ19qb2InLFxuICAgICAgICAgICAgICAgIGZlYXR1cmVUeXBlOiAnU3RyaW5nJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZmVhdHVyZU5hbWU6ICdzdGF0dXMnLFxuICAgICAgICAgICAgICAgIGZlYXR1cmVUeXBlOiAnU3RyaW5nJyxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBmZWF0dXJlR3JvdXBOYW1lOiB0aGlzLl9mZWF0dXJlR3JvdXBOYW1lLFxuICAgICAgICAgICAgcmVjb3JkSWRlbnRpZmllckZlYXR1cmVOYW1lOiAnc291cmNlX3JlZicsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1N0b3JlcyBib3VuZGluZyBib3ggZGF0YXNldCBmb3IgcXVhbGl0eSBpbnNwZWN0aW9uJyxcbiAgICAgICAgICAgIG9mZmxpbmVTdG9yZUNvbmZpZzogb2ZmbGluZVN0b3JlQ29uZmlnLFxuICAgICAgICAgICAgcm9sZUFybjogcm9sZS5yb2xlQXJuLFxuXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHNlZWRMYWJlbHNGdW5jdGlvbiA9IG5ldyBEb2NrZXJJbWFnZUZ1bmN0aW9uKHRoaXMsICdTZWVkTGFiZWxzVG9GZWF0dXJlU3RvcmVGdW5jdGlvbicsIHtcbiAgICAgICAgICAgIGNvZGU6IERvY2tlckltYWdlQ29kZS5mcm9tSW1hZ2VBc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhL3NlZWRfbGFiZWxzX3RvX2ZlYXR1cmVfc3RvcmUnKSksXG4gICAgICAgICAgICBhcmNoaXRlY3R1cmU6IEFyY2hpdGVjdHVyZS5YODZfNjQsXG4gICAgICAgICAgICBmdW5jdGlvbk5hbWU6IFwiU2VlZExhYmVsc1RvRmVhdHVyZVN0b3JlRnVuY3Rpb25cIixcbiAgICAgICAgICAgIG1lbW9yeVNpemU6IDEwMjQsXG4gICAgICAgICAgICByb2xlOiByb2xlLFxuICAgICAgICAgICAgdGltZW91dDogRHVyYXRpb24uc2Vjb25kcygzMDApLFxuICAgICAgICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGN1c3RvbVJlc291cmNlID0gbmV3IEN1c3RvbVJlc291cmNlKHRoaXMsICdTZWVkTGFiZWxzQ3VzdG9tUmVzb3VyY2UnLCB7XG4gICAgICAgICAgICBzZXJ2aWNlVG9rZW46IHNlZWRMYWJlbHNGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBmZWF0dXJlX2dyb3VwX25hbWU6IHByb3BzLmZlYXR1cmVHcm91cE5hbWUsXG4gICAgICAgICAgICAgICAgbGFiZWxzX3VyaTogYHMzOi8vJHtkYXRhQnVja2V0LmJ1Y2tldE5hbWV9L3BpcGVsaW5lL2Fzc2V0cy9sYWJlbHMvbGFiZWxzLmNzdmBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgZmVhdHVyZUdyb3VwLm5vZGUuYWRkRGVwZW5kZW5jeShidWNrZXREZXBsb3ltZW50KTtcbiAgICAgICAgY3VzdG9tUmVzb3VyY2Uubm9kZS5hZGREZXBlbmRlbmN5KGZlYXR1cmVHcm91cCk7XG4gICAgICAgIHJldHVybiBmZWF0dXJlR3JvdXBcbiAgICB9XG5cbiAgICBjcmVhdGVNb2RlbFBhY2thZ2VHcm91cChwcm9wczogQXBwQ29uZmlnKSB7XG5cbiAgICAgICAgY29uc3QgY2ZuTW9kZWxQYWNrYWdlR3JvdXAgPSBuZXcgc2FnZW1ha2VyLkNmbk1vZGVsUGFja2FnZUdyb3VwKHRoaXMsICdNeUNmbk1vZGVsUGFja2FnZUdyb3VwJywge1xuICAgICAgICAgICAgbW9kZWxQYWNrYWdlR3JvdXBOYW1lOiBwcm9wcy5tb2RlbFBhY2thZ2VHcm91cE5hbWUsXG4gICAgICAgICAgICBtb2RlbFBhY2thZ2VHcm91cERlc2NyaXB0aW9uOiBwcm9wcy5tb2RlbFBhY2thZ2VHcm91cERlc2NyaXB0aW9uLFxuICAgICAgICB9KTtcblxuICAgICAgICBjZm5Nb2RlbFBhY2thZ2VHcm91cC5hcHBseVJlbW92YWxQb2xpY3koUmVtb3ZhbFBvbGljeS5ERVNUUk9ZKVxuICAgICAgICByZXR1cm4gY2ZuTW9kZWxQYWNrYWdlR3JvdXBcbiAgICB9XG59XG4iXX0=