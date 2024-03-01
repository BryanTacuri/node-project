#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { BemFnDepositoExpressStack } from "../lib/bem-fn-deposito-express-stack";
import { SecretManager } from "../config/SecretManager";

const app = new cdk.App();
const nameStackApplication = "bem-fn-deposito-express-stack";
const Main = async (app: any) => {
  const stage = app.node.tryGetContext("stage") || "dev";
  const region = app.node.tryGetContext("region") || "us-east-1";
  const secretManager = new SecretManager(region);

  const config: { STAGE?: string } = {}; // Aquí se define STAGE como una propiedad opcional
  // Lista de nombres de secretos que deseas recuperar
  const secretName = "bem-fn-deposito-express";
  const secretJson = await secretManager.getSecret(secretName);
  config.STAGE = stage;
  Object.assign(config, secretJson);

  // Objeto para almacenar las variables de configuración
  try {
    new BemFnDepositoExpressStack(app, `${nameStackApplication}-${stage}`, {
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: region,
      },
      tags: config,
    });
  } catch (e) {
    console.error(e);
  }

  app.synth();
};

Main(app);
