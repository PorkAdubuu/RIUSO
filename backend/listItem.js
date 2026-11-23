
const {
  DynamoDBDocumentClient,
  ScanCommand
} = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async () => {
  try {
    if (!TABLE_NAME) {
      return response(500, {
        message: "TABLE_NAME environment variable is not configured."
      });
    }

    const result = await db.send(
      new ScanCommand({
        TableName: TABLE_NAME
      })
    );

    const items = result.Items || [];

    // Make expired reservations available again.
    const now = Math.floor(Date.now() / 1000);

    const updatedItems = items.map((item) => {
      if (
        item.status === "reserved" &&
        item.reservedUntil <= now
      ) {
        return {
          ...item,
          status: "available"
        };
      }

      return item;
    });

    return response(200, updatedItems);

  } catch (error) {
    console.error("List items error:", error);

    return response(500, {
      message: "Unable to retrieve items."
    });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS"
    },
    body: JSON.stringify(body)
  };
}
