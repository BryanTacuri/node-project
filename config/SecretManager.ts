// secret-manager.ts
import * as secretsManager from "aws-sdk/clients/secretsmanager";

export class SecretManager {
  private client: secretsManager;

  constructor(region: string) {
    this.client = new secretsManager({ region: region });
  }

  async getSecret(secretName: string): Promise<any> {
    try {
      const secretValue = await this.client
        .getSecretValue({ SecretId: secretName })
        .promise();

      if (secretValue.SecretString) {
        console.log(`Secret ${secretName} retrieved successfully`);
        return JSON.parse(secretValue.SecretString);
      }
    } catch (error) {
      console.error(`Error retrieving secret ${secretName}: ${error}`);
      throw error;
    }
  }
}
