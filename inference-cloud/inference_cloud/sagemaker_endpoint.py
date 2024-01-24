import os
from constructs import Construct
from aws_cdk import (
    aws_sagemaker as sagemaker,
    aws_iam as iam,
    aws_lambda as lambda_,
    aws_events as events,
    aws_events_targets as targets,
    aws_s3 as s3,
    aws_apigateway as api_gw,
)
from .model_helper import get_model_package_group_name, get_model_url


class SagemakerEndpointConstruct(Construct):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # queue = sqs.Queue(
        #     self, "InferenceCloudQueue",
        #     visibility_timeout=Duration.seconds(300),
        # )

        # topic = sns.Topic(
        #     self, "InferenceCloudTopic"
        # )

        # topic.add_subscription(subs.SqsSubscription(queue))
        # construct variables
        image_uri = "763104351884.dkr.ecr.us-east-1.amazonaws.com/pytorch-inference:1.12.1-cpu-py38-ubuntu20.04-sagemaker"
        model_name = "tag-quality-inspection-model"
        endpoint_config_name = "tag-quality-inspection-epc"
        endpoint_name = "tag-quality-inspection-endpoint"
        execution_role_arn = "arn:aws:iam::809378912851:role/service-role/AmazonSageMaker-ExecutionRole-20200419T123946"

        # model_data_url = "s3://sagemaker-us-east-1-809378912851/yolov8/demo-custom-endpoint/model.tar.gz"
        model_package_group_name = get_model_package_group_name('MLOps-Init-Stack')
        model_data_url = get_model_url(model_package_group_name)

        # Create a lambda role for sagemaker
        quality_inspection_sagemaker_role = iam.Role(
            self,
            "quality-inspection-sagemaker-role",
            role_name="quality-inspection-model-sagemaker-role",
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "AmazonSageMakerFullAccess"
                ),
                iam.ManagedPolicy.from_aws_managed_policy_name("AmazonS3FullAccess"),
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "AmazonEC2ContainerRegistryFullAccess"
                ),
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "AmazonDynamoDBFullAccess"
                ),
                iam.ManagedPolicy.from_aws_managed_policy_name("AWSLambda_FullAccess"),
            ],
            assumed_by=iam.ServicePrincipal("sagemaker.amazonaws.com"),
        )
        # create container
        yolo_model_name = "best.onnx"
        container_environment = {
            "SAGEMAKER_PROGRAM": "inference.py",
            "YOLOV8_MODEL": yolo_model_name,
        }
        container = sagemaker.CfnModel.ContainerDefinitionProperty(
            environment=container_environment,
            image=image_uri,
            mode="SingleModel",
            model_data_url=model_data_url,
        )
        # create Sagemaker model instance
        model = sagemaker.CfnModel(
            self,
            "quality-inspection-model",
            model_name=model_name,
            containers=[container],
            execution_role_arn=quality_inspection_sagemaker_role.role_arn,
        )

        # create Sagemaker endpoint configurations
        endpoint_configuration = sagemaker.CfnEndpointConfig(
            self,
            "quality-inspection-epc",
            endpoint_config_name=endpoint_config_name,
            production_variants=[
                sagemaker.CfnEndpointConfig.ProductionVariantProperty(
                    initial_instance_count=1,
                    instance_type="ml.m5.4xlarge",
                    model_name=model.model_name,
                    initial_variant_weight=1.0,
                    variant_name=model.model_name,
                )
            ],
        )

        # create Sagemaker endpoint
        endpoint = sagemaker.CfnEndpoint(
            self,
            "quality-inspection-endpoint",
            endpoint_name=endpoint_name,
            endpoint_config_name=endpoint_configuration.endpoint_config_name,
        )

        # adds depends on for different resources
        endpoint_configuration.node.add_dependency(model)
        endpoint.node.add_dependency(endpoint_configuration)

        # construct export values
        self.endpoint_name = endpoint.endpoint_name
