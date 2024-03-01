import * as cdk from "aws-cdk-lib";
import {
  NodejsFunction,
  NodejsFunctionProps,
} from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { createRole } from "./iam-role";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ec2 from "aws-cdk-lib/aws-ec2";

import path = require("path");
import { createCognitoResources } from "./cognito.resources";

export class BemFnDepositoExpressStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //*VARIABLES
    const config: any = props?.tags;
    const scopeName = `${this.stackName}-scope`;
    const srvName = `${this.stackName}-srv`;
    const roleStack = createRole(this);
    const userPool = createCognitoResources(this, scopeName, srvName);
    const apigatewayName = this.stackName + "-" + config.STAGE;
    const authScope = `${srvName}/${scopeName}`;

    //*CONFIGURACIÓN GENERAL DE LAS FUNCIONES
    const nodeJsFunctionProps: NodejsFunctionProps = {
      bundling: {
        minify: true,
        // externalModules: ["aws-sdk"],
      },
      timeout: cdk.Duration.seconds(30),
      runtime: lambda.Runtime.NODEJS_20_X,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: 14, //* 14 days
    };
    //*VPC

    const vpcLambda = ec2.Vpc.fromVpcAttributes(this, "ExistingVpcLambda", {
      vpcId: config.VPC_ID,
      availabilityZones: ["us-east-1a", "us-east-1b", "us-east-1c"],
    });

    ///Subnets
    const subnetIdsLambdas_ = [
      config.SUBNET_1a,
      config.SUBNET_1b,
      config.SUBNET_1c,
    ];

    const existingSubnet = subnetIdsLambdas_.map((subnetId, index) =>
      ec2.Subnet.fromSubnetId(this, `ExistingSubnet${index}`, subnetId)
    );

    //*LAMBDA 1 - DEPOSITO
    const envDeposit = {
      URL: config.SERVICIO1,
    };
    const depositoFn = new NodejsFunction(this, "depositoFunction", {
      functionName: this.stackName + "-fn-deposito-express",
      handler: "deposito",
      entry: path.join(__dirname, "../src/functions/deposito.ts"),
      role: roleStack,
      memorySize: 400,
      vpc: vpcLambda,
      environment: envDeposit,
      vpcSubnets: {
        subnets: existingSubnet,
      },
      ...nodeJsFunctionProps,
    });

    //*LAMBDA 2 - IDENTIFICADOR
    const identificadorFn = new NodejsFunction(this, "identificadorFunction", {
      functionName: this.stackName + "-fn-identificador-express",
      handler: "identificador",
      role: roleStack,
      entry: path.join(__dirname, "../src/functions/identificador.ts"),
      memorySize: 400,
      vpc: vpcLambda,
      environment: {
        SERVICIO1: config.URLSERVICIO1,
      },
      vpcSubnets: {
        subnets: existingSubnet,
      },
      ...nodeJsFunctionProps,
    });

    //*INTEGRACIONES DE API GATEWAY
    const depositoIntegration = new apigateway.LambdaIntegration(depositoFn);
    const identificadorIntegration = new apigateway.LambdaIntegration(
      identificadorFn
    );

    //*CREACIÓN DE AUTHORIZER DE API GATEWAY
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      "authorizer",
      {
        cognitoUserPools: [userPool],
        identitySource: "method.request.header.Authorization",
        authorizerName: "cognito-authorizer",
      }
    );

    //*CREACIÓN DE API GATEWAY
    const api = new apigateway.RestApi(this, apigatewayName, {
      restApiName: apigatewayName,
      deployOptions: {
        stageName: `${config?.STAGE}`,
        tracingEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["*"],
      },
    });

    //*ASIGNACIÓN DE AUTHORIZER A API GATEWAY
    authorizer._attachToApi(api);

    //*ASIGNACIÓN DE AUTHORIZER A LOS RECURSOS DE API GATEWAY
    const authorizerWithAuth: apigateway.MethodOptions = {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: {
        authorizerId: authorizer.authorizerId,
      },
      authorizationScopes: [`${authScope}`],
    };

    //*CREACIÓN DE RECURSOS DE API GATEWAY
    const identificadorResource = api.root.addResource(`identificador`);
    const depositoResource = api.root.addResource(`deposito`);

    //*ASIGNACIÓN DE INTEGRACIONES A LOS RECURSOS DE API GATEWAY
    identificadorResource.addMethod(
      "POST",
      identificadorIntegration,
      authorizerWithAuth
    );

    depositoResource.addMethod("POST", depositoIntegration, authorizerWithAuth);
  }
}
