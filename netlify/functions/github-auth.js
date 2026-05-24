// Exchanges GitHub OAuth code for an access token (server-side, keeps secret safe)
exports.handler = async ({ queryStringParameters }) => {
  const { code, state } = queryStringParameters || {};
  if (!code) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing code' }) };
  }

  try {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const data = await res.json();
    if (!data.access_token) {
      return { statusCode: 302, headers: { Location: '/?auth=error' } };
    }

    return {
      statusCode: 302,
      headers: {
        Location: `/?token=${encodeURIComponent(data.access_token)}&state=${state || ''}`,
      },
    };
  } catch (err) {
    return { statusCode: 302, headers: { Location: '/?auth=error' } };
  }
};
