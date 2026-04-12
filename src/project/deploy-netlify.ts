/**
 * Deploy a zip blob to Netlify via their API.
 *
 * Uses the Netlify API v1:
 * - POST /api/v1/sites (create site + deploy in one step)
 * - Requires a personal access token from https://app.netlify.com/user/applications#personal-access-tokens
 */

export interface NetlifyDeployResult {
  siteUrl: string;
  adminUrl: string;
  deployId: string;
}

export async function deployToNetlify(
  zipBlob: Blob,
  siteName: string,
  token: string,
): Promise<NetlifyDeployResult> {
  // Step 1: Create a new site
  const createRes = await fetch('https://api.netlify.com/api/v1/sites', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: siteName.replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create Netlify site: ${err}`);
  }

  const site = await createRes.json();
  const siteId = site.id;

  // Step 2: Deploy the zip to the site
  const deployRes = await fetch(
    `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/zip',
      },
      body: zipBlob,
    },
  );

  if (!deployRes.ok) {
    const err = await deployRes.text();
    throw new Error(`Failed to deploy to Netlify: ${err}`);
  }

  const deploy = await deployRes.json();

  return {
    siteUrl: deploy.ssl_url || deploy.url || `https://${site.subdomain}.netlify.app`,
    adminUrl: deploy.admin_url || `https://app.netlify.com/sites/${site.name}`,
    deployId: deploy.id,
  };
}
