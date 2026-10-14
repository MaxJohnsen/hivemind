-- Assistants connect as the person who signed in, over OAuth.
--
-- Better Auth issues the tokens. Its tables for that are below, as it
-- generates them for the jwt, mcp and cimd plugins. Homing checks on every
-- request that the person hasn't disconnected the assistant, so the personal
-- tokens that came before are gone.

create table auth."jwks" (
  "id" uuid default gen_random_uuid() not null primary key,
  "publicKey" text not null,
  "privateKey" text not null,
  "createdAt" timestamptz not null,
  "expiresAt" timestamptz,
  "alg" text,
  "crv" text
);

create table auth."oauthClient" (
  "id" uuid default gen_random_uuid() not null primary key,
  "clientId" text not null unique,
  "clientSecret" text,
  "clientDiscoveryId" text,
  "disabled" boolean,
  "skipConsent" boolean,
  "enableEndSession" boolean,
  "subjectType" text,
  "scopes" jsonb,
  "clientCredentialsScopes" jsonb,
  "userId" uuid references auth."user" ("id") on delete cascade,
  "createdAt" timestamptz,
  "updatedAt" timestamptz,
  "name" text,
  "uri" text,
  "icon" text,
  "contacts" jsonb,
  "tos" text,
  "policy" text,
  "softwareId" text,
  "softwareVersion" text,
  "softwareStatement" text,
  "redirectUris" jsonb not null,
  "postLogoutRedirectUris" jsonb,
  "backchannelLogoutUri" text,
  "backchannelLogoutSessionRequired" boolean,
  "tokenEndpointAuthMethod" text,
  "applicationType" text,
  "jwks" text,
  "jwksUri" text,
  "grantTypes" jsonb,
  "responseTypes" jsonb,
  "requirePKCE" boolean,
  "dpopBoundAccessTokens" boolean,
  "referenceId" text,
  "metadata" jsonb
);

create table auth."oauthResource" (
  "id" uuid default gen_random_uuid() not null primary key,
  "identifier" text not null unique,
  "name" text not null,
  "accessTokenTtl" integer,
  "refreshTokenTtl" integer,
  "signingAlgorithm" text,
  "signingKeyId" text,
  "allowedScopes" jsonb,
  "customClaims" jsonb,
  "dpopBoundAccessTokensRequired" boolean,
  "disabled" boolean,
  "createdAt" timestamptz,
  "updatedAt" timestamptz,
  "policyVersion" integer,
  "metadata" jsonb
);

create table auth."oauthClientResource" (
  "id" uuid default gen_random_uuid() not null primary key,
  "clientId" text not null references auth."oauthClient" ("clientId") on delete cascade,
  "resourceId" text not null references auth."oauthResource" ("identifier") on delete cascade,
  "metadata" jsonb,
  "createdAt" timestamptz
);

create table auth."oauthRefreshToken" (
  "id" uuid default gen_random_uuid() not null primary key,
  "token" text not null unique,
  "clientId" text not null references auth."oauthClient" ("clientId") on delete cascade,
  "sessionId" uuid references auth."session" ("id") on delete set null,
  "userId" uuid not null references auth."user" ("id") on delete cascade,
  "referenceId" text,
  "authorizationCodeId" text,
  "resources" jsonb,
  "requestedUserInfoClaims" jsonb,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null,
  "revoked" timestamptz,
  "rotatedAt" timestamptz,
  "rotationReplayResponse" text,
  "rotationReplayExpiresAt" timestamptz,
  "authTime" timestamptz,
  "confirmation" jsonb,
  "scopes" jsonb not null
);

create table auth."oauthAccessToken" (
  "id" uuid default gen_random_uuid() not null primary key,
  "token" text not null unique,
  "clientId" text not null references auth."oauthClient" ("clientId") on delete cascade,
  "sessionId" uuid references auth."session" ("id") on delete set null,
  "userId" uuid references auth."user" ("id") on delete cascade,
  "referenceId" text,
  "authorizationCodeId" text,
  "resources" jsonb,
  "requestedUserInfoClaims" jsonb,
  "refreshId" uuid references auth."oauthRefreshToken" ("id") on delete cascade,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null,
  "revoked" timestamptz,
  "confirmation" jsonb,
  "scopes" jsonb not null
);

create table auth."oauthConsent" (
  "id" uuid default gen_random_uuid() not null primary key,
  "clientId" text not null references auth."oauthClient" ("clientId") on delete cascade,
  "userId" uuid references auth."user" ("id") on delete cascade,
  "referenceId" text,
  "resources" jsonb,
  "requestedUserInfoClaims" jsonb,
  "scopes" jsonb not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null
);

create table auth."oauthClientAssertion" (
  "id" uuid default gen_random_uuid() not null primary key,
  "expiresAt" timestamptz not null
);

create index "oauthClient_userId_idx" on auth."oauthClient" ("userId");
create index "oauthClientResource_clientId_idx" on auth."oauthClientResource" ("clientId");
create index "oauthClientResource_resourceId_idx" on auth."oauthClientResource" ("resourceId");
create index "oauthRefreshToken_clientId_idx" on auth."oauthRefreshToken" ("clientId");
create index "oauthRefreshToken_sessionId_idx" on auth."oauthRefreshToken" ("sessionId");
create index "oauthRefreshToken_userId_idx" on auth."oauthRefreshToken" ("userId");
create index "oauthRefreshToken_authorizationCodeId_idx" on auth."oauthRefreshToken" ("authorizationCodeId");
create index "oauthAccessToken_clientId_idx" on auth."oauthAccessToken" ("clientId");
create index "oauthAccessToken_sessionId_idx" on auth."oauthAccessToken" ("sessionId");
create index "oauthAccessToken_userId_idx" on auth."oauthAccessToken" ("userId");
create index "oauthAccessToken_authorizationCodeId_idx" on auth."oauthAccessToken" ("authorizationCodeId");
create index "oauthAccessToken_refreshId_idx" on auth."oauthAccessToken" ("refreshId");
create index "oauthConsent_clientId_idx" on auth."oauthConsent" ("clientId");
create index "oauthConsent_userId_idx" on auth."oauthConsent" ("userId");
create unique index "oauthClientResource_clientId_resourceId_uidx" on auth."oauthClientResource" ("clientId", "resourceId");

-- Personal tokens for local agents are replaced by OAuth.
drop function create_token, revoke_tokens, authenticate;
drop table tokens;
