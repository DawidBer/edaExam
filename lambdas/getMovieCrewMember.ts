import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { MovieCastMemberQueryParams } from "../shared/types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";

const ajv = new Ajv();
const isValidQueryParams = ajv.compile(
  schema.definitions["MovieCrewMemberQueryParams"] || {}
);

const ddbDocClient = createDocumentClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event: ", event);
    const parameters = event?.pathParameters;
    const movieId = parameters?.movieId? parseInt(parameters.movieId): undefined;
    // const roleName = parameters?.roleName? parseInt(parameters.roleName): undefined;

    // if (!roleName) {
    //   return {
    //     statusCode: 404,
    //     headers: {
    //       "content-type": "application/json",
    //     },
    //     body: JSON.stringify({ Message: "Missing Role Name", roleName }),
    //   };
    // }

    if (!movieId) {
        return {
          statusCode: 404,
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ Message: "Missing Movie ID" }),
        };
      }

    const queryParams = event.queryStringParameters;
    if (queryParams && !isValidQueryParams(queryParams)) {
      return {
        statusCode: 500,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: `Incorrect type. Must match Query parameters schema`,
          schema: schema.definitions["MovieCrewMemberQueryParams"],
        }),
      };
    }

    let commandInput: QueryCommandInput = {
      TableName: process.env.TABLE_NAME,
    };

    if (queryParams) {
      if ("roleName" in queryParams) {
        commandInput = {
          ...commandInput,
          IndexName: "roleIx",
          KeyConditionExpression: "movieId = :m and begins_with(roleName, :r) ",
          ExpressionAttributeValues: {
            ":r": queryParams.roleName,
            ":m": movieId,
          },
        };
      } 
    } else {
      commandInput = {
        ...commandInput,
        KeyConditionExpression: "movieId = :m",
        ExpressionAttributeValues: {
          ":m": movieId,
        },
      };
    }

    const commandOutput = await ddbDocClient.send(
      new QueryCommand(commandInput)
    );

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        data: commandOutput.Items,
      }),
    };
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error }),
    };
  }
};

function createDocumentClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
