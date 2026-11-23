
const {
  DynamoDBDocumentClient,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
  try {
    if (!TABLE_NAME) {
      return response(500, {
        message: "TABLE_NAME environment variable is not configured."
      });
    }

    const itemId = event.pathParameters?.itemId;
    const body = JSON.parse(event.body || "{}");

    const { name, contact } = body;

    if (!itemId || !name?.trim() || !contact?.trim()) {
      return response(400, {
        message: "Item ID, shopper name, and contact number are required."
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const reservedUntil = now + (2 * 24 * 60 * 60);

    const result = await db.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { itemId },

        UpdateExpression: `
          SET #status = :reserved,
              shopperName = :name,
              shopperContact = :contact,
              reservedAt = :now,
              reservedUntil = :deadline
          REMOVE soldAt
        `,

        ConditionExpression: `
          attribute_exists(itemId)
          AND (
            #status = :available
            OR (
              #status = :reserved
              AND reservedUntil <= :now
            )
          )
        `,

        ExpressionAttributeNames: {
          "#status": "status"
        },

        ExpressionAttributeValues: {
          ":available": "available",
          ":reserved": "reserved",
          ":name": name.trim(),
          ":contact": contact.trim(),
          ":now": now,
          ":deadline": reservedUntil
        },

        ReturnValues: "ALL_NEW"
      })
    );

    return response(200, {
      message: "Item reserved successfully.",
      item: result.Attributes,
      reservedUntil
    });

  } catch (error) {
    console.error("Reservation error:", error);

    if (error.name === "ConditionalCheckFailedException") {
      return response(409, {
        message: "This item is already reserved or sold."
      });
    }

    return response(500, {
      message: "Unable to reserve item."
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
