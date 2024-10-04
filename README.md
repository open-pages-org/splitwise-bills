# AWS Splitwise Bills

This project is a simple AWS CDK stack that sends bills to Splitwise users every month. The stack is deployed using the AWS CDK and the resources are created using CloudFormation.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `npx cdk deploy` deploy this stack to your default AWS account/region
- `npx cdk diff` compare deployed stack with current state
- `npx cdk synth` emits the synthesized CloudFormation template

## Deployment

To deploy the stack, you need to have the AWS CLI installed and configured with your AWS account. You can install the AWS CLI by following the instructions [here](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html).

Additionally this project will be deployed using a GitHub Actions workflow. The workflow will be triggered when a new commit is pushed to the `main` branch.
