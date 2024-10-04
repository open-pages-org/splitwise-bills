import { DynamoDBClient, QueryCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { SSM } from '@aws-sdk/client-ssm';
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getKrakenToken, getBills, KrakenBill, downloadBill } from "./octopus";
import { createExpense } from "./splitwise";

const billsTable = process.env.BILLS_TABLE;
if (!billsTable) {
  throw new Error("No bills table defined");
}

const billsBucket = process.env.BILLS_BUCKET;
if (!billsBucket) {
  throw new Error("No bills bucket defined");
}

const ssm = new SSM({
  region: "eu-west-2",
});
const dynamoDBClient = new DynamoDBClient({
  region: "eu-west-2",
});
const s3Client = new S3Client({
  region: "eu-west-2",
});

const getKrakenBills = async () => {
  const krakenAPIKey = (await ssm.getParameter({
    Name: "/splitwise-bills/kraken-api-key",
    WithDecryption: true,
  }))?.Parameter?.Value;

  const accountId = (await ssm.getParameter({
    Name: "/splitwise-bills/octopus-account-id",
  }))?.Parameter?.Value;


  if (!krakenAPIKey) {
    throw new Error("No kraken API key found");
  }

  if (!accountId) {
    throw new Error("No octopus account id found");
  }

  const token = await getKrakenToken(krakenAPIKey);
  const bills = await getBills(token, accountId);

  console.log(`Found ${bills.length} bills`);

  return bills;
}

const addToDynamoDB = async (bill: KrakenBill) => {
  console.log(`Adding bill to dynamo: ${bill.id}`);
  const command = new PutItemCommand({
    TableName: billsTable,
    Item: {
      id: { S: bill.id },
      billType: { S: bill.billType },
      fromDate: { S: bill.fromDate },
      toDate: { S: bill.toDate },
      issuedDate: { S: bill.issuedDate },
      total: { N: bill.total.toString() },
    },
  });

  await dynamoDBClient.send(command);
  console.log(`Added bill to dynamo: ${bill.id}`);
}

const saveToS3 = async (bill: KrakenBill) => {
  console.log(`Saving bill to S3: ${bill.id}`);
  const billPDFBuffer = await downloadBill(bill.temporaryUrl);

  const command = new PutObjectCommand({
    Bucket: billsBucket,
    Key: `octopus/${bill.id}.pdf`,
    Body: billPDFBuffer,
    ContentType: "application/pdf",
  });

  await s3Client.send(command);

  console.log(`Saved bill to S3: ${bill.id}`);
}

const addToSplitwise = async (bill: KrakenBill) => {
  console.log(`Adding bill to splitwise: ${bill.id}`);
  const category = 1; // Utilities
  const groupId = (await ssm.getParameter({
    Name: "/splitwise-bills/splitwise-group-id",
  }))?.Parameter?.Value;
  const apiKey = (await ssm.getParameter({
    Name: "/splitwise-bills/splitwise-api-key",
    WithDecryption: true,
  }))?.Parameter?.Value;

  if (!apiKey) {
    throw new Error("No splitwise API key found");
  }

  if (!groupId) {
    throw new Error("No splitwise group id found");
  }

  const result = await createExpense(apiKey, {
    cost: bill.total / 100,
    description: bill.billType,
    details: `Octopus Energy Bill from ${bill.fromDate} to ${bill.toDate}`,
    date: bill.issuedDate,
    repeat_interval: "never",
    currency_code: "GBP",
    category_id: category,
    group_id: parseInt(groupId),
    split_equally: true,
  });

  console.log(`Add bill to splitwise ${bill.id} result`, result);

  return result;
}

export const handler = async () => {
  const allBills = await getKrakenBills();

  const newBills: KrakenBill[] = [];

  const promises = allBills.map(async (bill) => {
    const command = new QueryCommand({
      TableName: billsTable,
      KeyConditionExpression: "id = :id",
      ExpressionAttributeValues: {
        ":id": { S: bill.id },
      },
    });

    const result = await dynamoDBClient.send(command);

    if (result.Items && result.Items.length === 0) {
      newBills.push(bill);
    }
  });

  await Promise.all(promises);

  console.log(`Found ${newBills.length} new bills`);

  const registerBillsPromises = newBills.map(async (bill) => {
    console.log(`Registering bill ${bill.id}`, bill);

    await addToSplitwise(bill);
    await addToDynamoDB(bill);
    await saveToS3(bill);
  });

  const results = await Promise.allSettled(registerBillsPromises);

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`Failed to register bill ${newBills[index].id}`, result.reason);
    }
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Processed ${newBills.length} new bills`,
    }),
  };
};
