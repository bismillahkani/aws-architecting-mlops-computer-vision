from constructs import Construct
from aws_cdk import (
    Duration,
    Stack,
    NestedStack,
    aws_iam as iam,
    aws_lambda as lambda_,
    aws_s3 as s3,
    aws_s3_notifications as s3_notify,
)

from .sagemaker_endpoint import SagemakerEndpointConstruct


class InferenceCloudStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # get the account id
        account_id = self.account

        # create model output s3 bucket
        # model_output_bucket = s3.Bucket(
        #     self,
        #     "model-output-bucket",
        #     bucket_name=f"quality-inspection-model-output-{account_id}",
        # )

        # create a sagemaker endpoint
        endpoint = SagemakerEndpointConstruct(self, "quality-inspection-endpoint")

