import { APIGatewayEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import * as AWSXRay from "aws-xray-sdk-core";
import * as AWSXRaySDK from "aws-xray-sdk";
import axios, { AxiosError } from "axios";

const URL = process.env.URL || "";
export const deposito = async (
  event: APIGatewayEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const segment = AWSXRay.getSegment();

    const request: any =
      typeof event.body === "object" ? event.body : JSON.parse(event.body);

    const resumeData: any = {
      //! TODO: Agregar los datos de la solicitud
      reason: request.reason,
      reasonCode: request.reasonCode,
      url: URL,
    };

    const response = await resumeCard(
      resumeData,
      segment as AWSXRaySDK.Segment
    );

    return {
      statusCode: response.statusCode,
      headers: { "Content-Type": "text/json" },
      body: JSON.stringify(response.data),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/json" },
      body: JSON.stringify({ message: JSON.stringify(error.message) }),
    };
  } finally {
    console.log("Fin de función");
  }
};

const resumeCard = async (
  resumeData: any,
  segment: AWSXRay.Segment
): Promise<{ statusCode: number; data: any }> => {
  const subsegment = segment?.addNewSubsegment(`Hit to deposito service`);

  const url = resumeData.URL;

  console.log("Solicitud a URL: ", url);

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  try {
    const response = await axios.post(url, resumeData, { headers });

    if (response.status >= 200 && response.status < 300) {
      return { statusCode: response.status, data: response.data };
    } else {
      throw new Error(`Error inesperado: ${response.status}`);
    }
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      console.error("Error al hacer la solicitud:", axiosError.message);
      console.error("Código de estado:", axiosError.response?.status);
      console.error("Data de respuesta:", axiosError.response?.data);

      return {
        statusCode: axiosError.response?.status ?? 500,
        data: axiosError.response?.data,
      };
    } else {
      console.error("Error inesperado:", error);

      return { statusCode: 500, data: error.message || "Error inesperado" };
    }
  } finally {
    subsegment?.close();
  }
};
