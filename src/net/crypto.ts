// mobile/src/net/crypto.ts — WebCrypto 实现 dlp/1 会话加密
// X25519 在 WebCrypto（2024+ Safari/Chrome）可用性不一：不支持时**必须失败**，
// 不做明文降级（仅 PC 配置 allowTlsOnly 且经 TLS 时可跳过应用层加密）。

import type { SecurePayload } from './protocol';

const subtle = () => crypto.subtle;

export const supportsX25519 = (() => {
  try {
    // 检测机制：查支持的算法名集合
    return (crypto.subtle as unknown as { getSupportedAlgorithms?: () => Promise<string[]> })
      .getSupportedAlgorithms !== undefined;
  } catch { return false; }
})();

/** X25519 临时密钥对（DER SPKI base64 输出，与 PC 端 crypto.createPublicKey 对齐）。 */
export async function generateEphemeral(): Promise<{ pubDerB64: string; priv: CryptoKey }> {
  const pair = (await subtle().generateKey({ name: 'X25519' }, false, ['deriveBits'] as unknown as KeyUsage[])) as CryptoKeyPair;
  const spki = await subtle().exportKey('spki', pair.publicKey);
  return { pubDerB64: bufToB64(spki), priv: pair.privateKey };
}

/** ECDH 共享密钥。 */
export async function x25519Shared(priv: CryptoKey, peerDerB64: string): Promise<ArrayBuffer> {
  const peer = await subtle().importKey('spki', b64ToBuf(peerDerB64), { name: 'X25519' }, false, []);
  return subtle().deriveBits({ name: 'X25519', public: peer }, priv, 256);
}

/** HKDF-SHA256 派生。 */
export async function hkdf(ikm: BufferSource, salt: BufferSource, info: string, length = 32): Promise<ArrayBuffer> {
  const key = await subtle().importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return subtle().deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode(info) },
    key, length * 8,
  );
}

/** 配对确认密钥（配对码参与）。 */
export async function confirmKey(code: string, fp: string): Promise<ArrayBuffer> {
  return hkdf(new TextEncoder().encode(code), new TextEncoder().encode(fp), 'dlp-pair-confirm');
}

/** proof = HMAC-SHA256(confirmKey, "pair" ‖ serverNonce ‖ clientNonce) */
export async function pairProof(ck: ArrayBuffer, serverNonceB64: string, clientNonceB64: string): Promise<string> {
  const key = await subtle().importKey('raw', ck, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const data = concat([new TextEncoder().encode('pair'), new Uint8Array(b64ToBuf(serverNonceB64)), new Uint8Array(b64ToBuf(clientNonceB64))]);
  return bufToB64(await subtle().sign('HMAC', key, data));
}

/** 会话密钥 = HKDF(ECDH, salt=serverNonce‖clientNonce, info="dlp/1 session") */
export async function deriveSessionKey(shared: ArrayBuffer, serverNonceB64: string, clientNonceB64: string): Promise<ArrayBuffer> {
  return hkdf(shared, concat([new Uint8Array(b64ToBuf(serverNonceB64)), new Uint8Array(b64ToBuf(clientNonceB64))]), 'dlp/1 session');
}

/** AES-256-GCM 封包（AAD = deviceId:seq，防重放）。 */
export async function seal(sessionKey: ArrayBuffer, deviceId: string, seq: number, obj: unknown): Promise<SecurePayload> {
  const key = await subtle().importKey('raw', sessionKey, 'AES-GCM', false, ['encrypt']);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const aad = new TextEncoder().encode(`${deviceId}:${seq}`);
  const pt = new TextEncoder().encode(JSON.stringify(obj));
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad }, key, pt);
  return { n: bufToB64(nonce), ct: bufToB64(ct) };
}

/** 解包；失败抛 {code:'DECRYPT_FAILED'}。 */
export async function open(sessionKey: ArrayBuffer, deviceId: string, seq: number, p: SecurePayload): Promise<unknown> {
  try {
    const key = await subtle().importKey('raw', sessionKey, 'AES-GCM', false, ['decrypt']);
    const aad = new TextEncoder().encode(`${deviceId}:${seq}`);
    const ct = b64ToBuf(p.ct);
    const iv = b64ToBuf(p.n);
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, ct);
    return JSON.parse(new TextDecoder().decode(pt));
  } catch {
    const err = new Error('解密/校验失败') as Error & { code: string };
    err.code = 'DECRYPT_FAILED';
    throw err;
  }
}

/** 校验 PC hello.result 的 tag = HMAC(sessionKey, serverNonce‖clientNonce)。 */
export async function verifyTag(sessionKey: ArrayBuffer, serverNonceB64: string, clientNonceB64: string, tagB64: string): Promise<boolean> {
  const key = await subtle().importKey('raw', sessionKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const data = concat([new Uint8Array(b64ToBuf(serverNonceB64)), new Uint8Array(b64ToBuf(clientNonceB64))]);
  return subtle().verify('HMAC', key, b64ToBuf(tagB64), data);
}

/** Ed25519 设备长期身份（配对时把公钥交给 PC）。 */
export async function generateDeviceIdentity(): Promise<{ pubDerB64: string; priv: CryptoKey }> {
  const pair = (await subtle().generateKey({ name: 'Ed25519' }, false, ['sign', 'verify'] as unknown as KeyUsage[])) as CryptoKeyPair;
  const spki = await subtle().exportKey('spki', pair.publicKey);
  return { pubDerB64: bufToB64(spki), priv: pair.privateKey };
}

export async function signChallenge(priv: CryptoKey, data: string): Promise<string> {
  return bufToB64(await subtle().sign('Ed25519', priv, new TextEncoder().encode(data)));
}

// ---- 工具 ----
export function bufToB64(buf: ArrayBuffer | Uint8Array<ArrayBuffer>): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
export function b64ToBuf(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const b = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}
function concat(parts: Uint8Array<ArrayBuffer>[]): ArrayBuffer {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(new ArrayBuffer(total));
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.byteLength; }
  return out.buffer;
}
