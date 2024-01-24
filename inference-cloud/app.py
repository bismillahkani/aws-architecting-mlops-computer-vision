#!/usr/bin/env python3

import aws_cdk as cdk
from aws_cdk import Aws

from inference_cloud.inference_cloud_stack import InferenceCloudStack

REGION = Aws.REGION
ACCOUNT_ID = Aws.ACCOUNT_ID

env_region = cdk.Environment(account=ACCOUNT_ID, region=REGION)

app = cdk.App()
InferenceCloudStack(app, "inference-cloud", env=env_region)

app.synth()