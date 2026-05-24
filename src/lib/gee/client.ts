import ee from '@google/earthengine';

/**
 * Initializes Google Earth Engine with Service Account credentials.
 * This is meant to be called in API routes.
 */
export async function initGEE() {
  return new Promise((resolve, reject) => {
    try {
      // Check if already initialized to prevent multiple calls
      if (ee.data.getAuthToken()) {
        return resolve(true);
      }

      const privateKey = JSON.parse(process.env.GEE_SERVICE_ACCOUNT_KEY || '{}');
      
      if (!privateKey.client_email || !privateKey.private_key) {
        throw new Error('Missing GEE Service Account credentials');
      }

      ee.data.authenticateViaPrivateKey(
        privateKey,
        () => {
          ee.initialize(
            null,
            null,
            () => resolve(true),
            (err: any) => reject(new Error(`GEE Initialization failed: ${err}`))
          );
        },
        (err: any) => reject(new Error(`GEE Authentication failed: ${err}`))
      );
    } catch (error) {
      reject(error);
    }
  });
}
