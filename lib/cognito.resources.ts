import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import {
  OAuthScope,
  ResourceServerScope,
  UserPool,
  UserPoolResourceServer,
} from "aws-cdk-lib/aws-cognito";

/**
 * Crea un rol de IAM para ser utilizado por funciones Lambda en la pila actual.
 * @param stack - La pila en la que se creará el rol.
 * @returns El rol de IAM creado con las políticas especificadas.
 */
export function createCognitoResources(
  stack: Stack,
  scopeName: any,
  srvName: any
): UserPool {
  const group = `${stack.stackName}-group`;
  const userPool = new UserPool(stack, group, {
    userPoolName: group,
    signInAliases: {
      email: true,
      username: true,
    },
    autoVerify: { email: true },
    removalPolicy: RemovalPolicy.DESTROY,
  });

  const apiReadScope = new ResourceServerScope({
    scopeName: scopeName,
    scopeDescription: "bem-fn-deposito-express scope",
  });

  const resourceServer = new UserPoolResourceServer(stack, srvName, {
    identifier: srvName,
    userPool,
    scopes: [apiReadScope],
  });

  userPool.addClient(`${stack.stackName}-cli`, {
    userPoolClientName: `${stack.stackName}-cli`,
    generateSecret: true,
    oAuth: {
      flows: {
        clientCredentials: true,
        authorizationCodeGrant: false,
        implicitCodeGrant: false,
      },
      scopes: [OAuthScope.resourceServer(resourceServer, apiReadScope)],
    },
    accessTokenValidity: Duration.minutes(10),
  });

  userPool.addDomain("cognito-domain", {
    cognitoDomain: {
      domainPrefix: `${stack.stackName}`,
    },
  });

  return userPool;
}
