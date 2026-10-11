import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test, { after, before } from 'node:test'
import { generateKeyPair, exportJWK, SignJWT } from 'jose'

const { privateKey, publicKey } = await generateKeyPair('RS256')
const publicJwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' }
let issuer
let nonce
let oidc
let server

before(async () => {
  server = createServer(async (request, response) => {
    if (request.url === '/realms/front/.well-known/openid-configuration') {
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks` }))
      return
    }
    if (request.url === '/realms/front/jwks') {
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ keys: [publicJwk] }))
      return
    }
    if (request.url === '/realms/front/token') {
      const chunks = []
      for await (const chunk of request) chunks.push(chunk)
      const body = new URLSearchParams(Buffer.concat(chunks).toString())
      const claims = { nonce: nonce || 'invalid-nonce', azp: 'railway-sign-web' }
      const idToken = await new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(issuer).setAudience('railway-sign-web').setSubject('test-subject')
        .setIssuedAt().setExpirationTime('2m').sign(privateKey)
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ access_token: 'server-only', id_token: idToken, verifier: body.get('code_verifier') }))
      return
    }
    response.writeHead(404).end()
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  issuer = `http://127.0.0.1:${server.address().port}/realms/front`
  process.env.OIDC_ISSUER = issuer
  process.env.OIDC_CLIENT_ID = 'railway-sign-web'
  process.env.OIDC_REDIRECT_ORIGINS = 'http://localhost:4028'
  oidc = await import('../server/api/lib/oidc.js')
})

after(async () => new Promise((resolve) => server.close(resolve)))

test('OIDC start limits callback origin and creates an S256 authorization request', async () => {
  await assert.rejects(oidc.beginOidc({ mode: 'login', redirectUri: 'https://attacker.example/oidc/callback' }), /未登记/)
  const result = await oidc.beginOidc({ mode: 'login', redirectUri: 'http://localhost:4028/oidc/callback' })
  const authorization = new URL(result.authorizationUrl)
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(authorization.searchParams.get('response_type'), 'code')
  const transaction = oidc.takeOidcTransaction(result.cookieKey, authorization.searchParams.get('state'))
  assert.equal(transaction.redirectUri, 'http://localhost:4028/oidc/callback')
})

test('OIDC callback exchanges code and verifies issuer, audience, nonce and subject', async () => {
  const started = await oidc.beginOidc({ mode: 'login', redirectUri: 'http://localhost:4028/oidc/callback' })
  const authorization = new URL(started.authorizationUrl)
  nonce = authorization.searchParams.get('nonce')
  const transaction = oidc.takeOidcTransaction(started.cookieKey, authorization.searchParams.get('state'))
  const identity = await oidc.exchangeOidcCode(transaction, 'one-time-code')
  assert.equal(identity.subject, 'test-subject')
})

test('OIDC callback rejects an ID token with a mismatched nonce', async () => {
  const started = await oidc.beginOidc({ mode: 'login', redirectUri: 'http://localhost:4028/oidc/callback' })
  const authorization = new URL(started.authorizationUrl)
  nonce = 'different-nonce'
  const transaction = oidc.takeOidcTransaction(started.cookieKey, authorization.searchParams.get('state'))
  await assert.rejects(oidc.exchangeOidcCode(transaction, 'one-time-code'))
})
