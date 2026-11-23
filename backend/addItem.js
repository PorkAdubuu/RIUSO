
const { randomUUID } = require("crypto");
const {
  DynamoDBDocumentClient,
  PutCommand
} = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");

    const { name, price, photo } = body;

    if (
      !name || !photo ||
      price === undefined ||
      price === null ||
      !Number.isFinite(Number(price)) ||
      Number(price) <= 0
    ) {
      return response(400, {
        message: "Please provide a valid item name, price, and photo filename."
      });
    }

    if (!TABLE_NAME) {
      return response(500, {
        message: "TABLE_NAME environment variable is not configured."
      });
    }

    const item = {
      itemId: randomUUID(),
      name: name.trim(),
      price: Number(price),
      photo: photo.trim(),
      status: "available",
      shopperName: null,
      shopperContact: null,
      reservedAt: null,
      reservedUntil: null,
      soldAt: null
    };

    await db.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: "attribute_not_exists(itemId)"
      })
    );

    return response(201, {
      message: "Item added successfully.",
      item
    });

  } catch (error) {
    console.error("Add item error:", error);

    return response(500, {
      message: "Unable to add item."
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
