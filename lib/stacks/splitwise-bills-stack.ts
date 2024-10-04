import { Duration, RemovalPolicy, Stack, aws_events, aws_events_targets, aws_lambda, type StackProps } from 'aws-cdk-lib';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export class SplitwiseBillsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const billsTable = new TableV2(this, 'splitwise-bills-octopus-table', {
      tableName: 'splitwise-bills-octopus',
      partitionKey: { name: 'id', type: AttributeType.STRING },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const lambda = new NodejsFunction(this, 'check-octopus-bills-lambda', {
      functionName: 'splitwise-bills-check-octopus-bills',
      runtime: aws_lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: "lib/functions/checkOctopusBills/index.ts",
      timeout: Duration.seconds(30),
      bundling: {
        platform: "node",
        mainFields: ['module', 'main'],
        format: OutputFormat.ESM,
      },
      environment: {
        BILLS_TABLE: billsTable.tableName,
      },
      memorySize: 256,
    });
    billsTable.grantReadWriteData(lambda);
    lambda.addToRolePolicy(new PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/splitwise-bills/kraken-api-key`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/splitwise-bills/octopus-account-id`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/splitwise-bills/splitwise-api-key`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/splitwise-bills/splitwise-group-id`,
      ],
    }));

    const rule = new aws_events.Rule(this, 'Rule', {
      schedule: aws_events.Schedule.expression('cron(0 18 ? * * *)')
    });

    rule.addTarget(new aws_events_targets.LambdaFunction(lambda));
  }
}
