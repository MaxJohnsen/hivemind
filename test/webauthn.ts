// A passkey in software, standing in for a phone or a laptop's authenticator.
// It speaks WebAuthn's JSON format, like @simplewebauthn/browser in the web app.

import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';

interface Credential {
  id: Buffer;
  rpId: string;
  userHandle: string;
  privateKey: KeyObject;
  counter: number;
}

type Options = Record<string, any>;

export class Authenticator {
  readonly origin: string;
  readonly credentials: Credential[] = [];

  constructor(origin: string) {
    this.origin = origin;
  }

  /** Creates a passkey, answering generate-register-options. Its id is random unless given. */
  register(options: Options, id: Buffer = randomBytes(16)) {
    const rpId = options.rp.id as string;
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const credential: Credential = { id, rpId, userHandle: options.user.id, privateKey, counter: 0 };
    this.credentials.push(credential);

    const { x, y } = publicKey.export({ format: 'jwk' });
    const coseKey = cbor(new Map<number, unknown>([
      [1, 2], // EC2
      [3, -7], // ES256
      [-1, 1], // P-256
      [-2, Buffer.from(x!, 'base64url')],
      [-3, Buffer.from(y!, 'base64url')],
    ]));
    const length = Buffer.alloc(2);
    length.writeUInt16BE(credential.id.length);
    const authData = Buffer.concat([
      authenticatorData(rpId, 0x45, 0), // user present and verified, with a credential
      Buffer.alloc(16), // no AAGUID
      length,
      credential.id,
      coseKey,
    ]);
    const credentialId = credential.id.toString('base64url');
    return {
      id: credentialId,
      rawId: credentialId,
      type: 'public-key',
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
      response: {
        clientDataJSON: this.clientData('webauthn.create', options.challenge),
        attestationObject: cbor(new Map<string, unknown>([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]])).toString('base64url'),
        transports: ['internal'],
      },
    };
  }

  /** Signs in with a passkey, answering generate-authenticate-options. */
  authenticate(options: Options, credential = this.credentials[0]) {
    credential.counter += 1;
    const authData = authenticatorData(credential.rpId, 0x05, credential.counter);
    const clientDataJSON = this.clientData('webauthn.get', options.challenge);
    const signature = sign('sha256', Buffer.concat([authData, sha256(Buffer.from(clientDataJSON, 'base64url'))]), credential.privateKey);
    const id = credential.id.toString('base64url');
    return {
      id,
      rawId: id,
      type: 'public-key',
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
      response: {
        clientDataJSON,
        authenticatorData: authData.toString('base64url'),
        signature: signature.toString('base64url'),
        userHandle: credential.userHandle,
      },
    };
  }

  private clientData(type: string, challenge: string): string {
    return Buffer.from(JSON.stringify({ type, challenge, origin: this.origin, crossOrigin: false })).toString('base64url');
  }
}

function authenticatorData(rpId: string, flags: number, counter: number): Buffer {
  const count = Buffer.alloc(4);
  count.writeUInt32BE(counter);
  return Buffer.concat([sha256(Buffer.from(rpId)), Buffer.from([flags]), count]);
}

function sha256(data: Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

/** Just enough CBOR for WebAuthn: maps, byte and text strings, and small integers. */
function cbor(value: unknown): Buffer {
  const head = (major: number, length: number) => {
    if (length < 24) return Buffer.from([(major << 5) | length]);
    if (length < 256) return Buffer.from([(major << 5) | 24, length]);
    const bytes = Buffer.alloc(3);
    bytes[0] = (major << 5) | 25;
    bytes.writeUInt16BE(length, 1);
    return bytes;
  };
  if (typeof value === 'number') return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (typeof value === 'string') return Buffer.concat([head(3, Buffer.byteLength(value)), Buffer.from(value)]);
  if (Buffer.isBuffer(value)) return Buffer.concat([head(2, value.length), value]);
  if (value instanceof Map) {
    return Buffer.concat([head(5, value.size), ...[...value].flatMap(([key, item]) => [cbor(key), cbor(item)])]);
  }
  throw new Error(`can't encode ${typeof value}`);
}
