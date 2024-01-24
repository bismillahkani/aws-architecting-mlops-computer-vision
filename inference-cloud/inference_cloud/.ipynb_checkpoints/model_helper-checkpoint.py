import boto3
from botocore.exceptions import ClientError

sm_client = boto3.client("sagemaker")
ssm_client = boto3.client("ssm")
cf_client = boto3.client('cloudformation')

def get_model_package_group_name(stackname):
    response = cf_client.describe_stacks(StackName=stackname)
    outputs = response["Stacks"][0]["Outputs"]
    for output in outputs:
        keyName = output["OutputKey"]
        if keyName == "modelPackageGroup":
            model_package_group_name = output["OutputValue"]
    return model_package_group_name

def get_model_url(model_package_group_name):
    # Get the latest approved model package
    response = sm_client.list_model_packages(
        ModelPackageGroupName=model_package_group_name,
        ModelApprovalStatus="Approved",
        SortBy="CreationTime",
        MaxResults=100,
    )
    approved_packages = response["ModelPackageSummaryList"]

    latest_model_arn = approved_packages[0]["ModelPackageArn"]
    model_details = sm_client.describe_model_package(ModelPackageName=latest_model_arn)
    model_url = model_details["InferenceSpecification"]["Containers"][0]["ModelDataUrl"]

    return model_url
