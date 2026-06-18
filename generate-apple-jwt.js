const crypto = require('crypto');

const teamId = 'JR29DNJS4W';
const keyId = '4ULGU3BTZM';

const privateKey = `-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgI61MueDuTRlv2bcW
idCUSva+88wNJpK98+VqpmAtnmSgCgYIKoZIzj0DAQehRANCAARVYeIfysMJNwXZ
COySw4niGVvEwHUH7f64C5Znn9wktcV6Tu8gIteSuyq1tQ8+vfVhPR1icRdfPABc
LZFxfW81
-----END PRIVATE KEY-----`;

function generateClientSecret(clientId) {
  const header = {
    alg: 'ES256',
    kid: keyId,
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 15777000, // 6 months (maximum allowed by Apple is 180 days)
    aud: 'https://appleid.apple.com',
    sub: clientId,
  };

  const base64UrlEncode = (obj) => {
    return Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  };

  const headerPart = base64UrlEncode(header);
  const payloadPart = base64UrlEncode(payload);
  const signingInput = `${headerPart}.${payloadPart}`;

  // Sign using ECDSA SHA256 (ES256)
  const signature = crypto.sign(
    'sha256',
    Buffer.from(signingInput),
    {
      key: privateKey,
      dsaEncoding: 'ieee-p1363', // IEEE P1363 format (concatenated R and S) as required by JWT standard for ES256
    }
  );

  const signaturePart = signature
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signingInput}.${signaturePart}`;
}

const webSecret = generateClientSecret('com.cielinfitech.astrodate.web');
const appSecret = generateClientSecret('com.cielinfitech.astrodate');

console.log('--- SIGN IN WITH APPLE CLIENT SECRETS (180 DAYS) ---');
console.log('\n[For Services ID / Web / Android: com.cielinfitech.astrodate.web]');
console.log(webSecret);
console.log('\n[For App Bundle ID / iOS: com.cielinfitech.astrodate]');
console.log(appSecret);
console.log('----------------------------------------------------');

