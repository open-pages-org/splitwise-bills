import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { SplitwiseBillsStack } from '../lib/stacks/splitwise-bills-stack';
import { test } from "vitest";

// example test. To run these tests, uncomment this file along with the
// example resource in lib/splitwise-bills.ts-stack.ts
test('DynamoDB Table Created', () => {
  const app = new cdk.App();
  const stack = new SplitwiseBillsStack(app, 'MyTestStack');
  const template = Template.fromStack(stack);

  template.hasResource('AWS::DynamoDB::GlobalTable', {});
});
