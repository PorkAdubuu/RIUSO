
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

    if (!itemId) {
      return response(400, {
        message: "Item ID is required."
      });
    }

    const now = Math.floor(Date.now() / 1000);

    const result = await db.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { itemId },

        UpdateExpression: `
          SET #status = :sold,
              soldAt = :now
        `,

        ConditionExpression: `
          attribute_exists(itemId)
          AND #status = :reserved
          AND reservedUntil > :now
        `,

        ExpressionAttributeNames: {
          "#status": "status"
        },

        ExpressionAttributeValues: {
          ":sold": "sold",
          ":reserved": "reserved",
          ":now": now
        },

        ReturnValues: "ALL_NEW"
      })
    );

    return response(200, {
      message: "Item marked as sold successfully.",
      item: result.Attributes
    });

  } catch (error) {
    console.error("Mark as sold error:", error);

    if (error.name === "ConditionalCheckFailedException") {
      return response(409, {
        message: "Only actively reserved items can be marked as sold."
      });
    }

    return response(500, {
      message: "Unable to mark item as sold."
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
