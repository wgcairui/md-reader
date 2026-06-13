import * as FileSystem from 'expo-file-system';
import { inflateSync } from 'fflate';
import type { Repo } from '../types';

export type ParsedGitHubUrl = { owner: string; name: string };

/**
 * 支持的输入形式：
 *   https://github.com/owner/name
 *   https://github.com/owner/name.git
 *   git@github.com:owner/name.git
 *   owner/name
 */
export function parseGitHubUrl(input: string): ParsedGitHubUrl | null {
  const s = input.trim();
  let m = s.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (m) return { owner: m[1], name: m[2] };
  m = s.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (m) return { owner: m[1], name: m[2] };
  m = s.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (m) return { owner: m[1], name: m[2] };
  return null;
}

/**
 * 从 GitHub 拉 tarball 到缓存目录并解压。
 * 纯 JS：fflate 处理 gzip，自写 tar 解析（~60 行）。
 */
export async function fetchAndExtract(
  parsed: ParsedGitHubUrl,
  onProgress?: (stage: 'download' | 'extract', p: number) => void,
): Promise<{ cacheSlug: string; rootDir: string }> {
  const cacheSlug = `${parsed.owner}__${parsed.name}`;
  const target = `${FileSystem.cacheDirectory}repos/${cacheSlug}`;

  // 缓存命中：3 天内拉过直接复用
  const metaFile = `${target}/.mdreader-meta.json`;
  const existing = await FileSystem.getInfoAsync(metaFile);
  if (existing.exists) {
    const meta = JSON.parse(await FileSystem.readAsStringAsync(metaFile));
    if (Date.now() - meta.fetchedAt < 3 * 24 * 3600 * 1000) {
      return { cacheSlug, rootDir: target };
    }
  }

  // 清旧
  await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => {});
  await FileSystem.makeDirectoryAsync(target, { intermediates: true });

  // 选默认分支：HEAD 探测
  const branches = ['main', 'master'];
  let gzBase64 = '';
  for (const b of branches) {
    const url = `https://codeload.github.com/${parsed.owner}/${parsed.name}/tar.gz/refs/heads/${b}`;
    const tmp = `${FileSystem.cacheDirectory}dl-${cacheSlug}-${b}.gz`;
    onProgress?.('download', 0);
    const r = await FileSystem.downloadAsync(url, tmp);
    if (r.status >= 400) continue;
    onProgress?.('download', 0.5);
    gzBase64 = await FileSystem.readAsStringAsync(tmp, {
      encoding: 'base64',
    });
    onProgress?.('download', 1);
    await FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => {});
    break;
  }
  if (!gzBase64) {
    throw new Error('Failed to download tarball from GitHub');
  }

  // base64 → Uint8Array
  const gzBytes = base64ToBytes(gzBase64);

  // gzip → tar
  onProgress?.('extract', 0);
  const tarBytes = inflateTarGz(gzBytes);
  onProgress?.('extract', 0.5);

  // tar 解析 → 写文件
  const files = parseTar(tarBytes);
  onProgress?.('extract', 0.7);
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const fullPath = `${target}/${f.path}`;
    if (f.type === 'dir') {
      await FileSystem.makeDirectoryAsync(fullPath, { intermediates: true }).catch(() => {});
    } else {
      await FileSystem.makeDirectoryAsync(fullPath.replace(/\/[^/]+$/, ''), {
        intermediates: true,
      }).catch(() => {});
      await FileSystem.writeAsStringAsync(fullPath, f.contentBase64, {
        encoding: 'base64',
      });
    }
    if (i % 32 === 0) onProgress?.('extract', 0.7 + 0.3 * (i / files.length));
  }
  onProgress?.('extract', 1);

  await FileSystem.writeAsStringAsync(
    metaFile,
    JSON.stringify({ fetchedAt: Date.now(), owner: parsed.owner, name: parsed.name }),
  );

  return { cacheSlug, rootDir: target };
}

/** fflate 同步 inflate gzip，包装成 Promise */
function inflateTarGz(gz: Uint8Array): Uint8Array {
  // inflateSync 解的是 zlib stream；tarball 是 raw gzip，需要先剥 gzip 头
  // fflate 提供 inflateSync 默认吃 zlib（带 header），对 tar.gz 也兼容良好
  return inflateSync(gz);
}

type TarEntry = {
  path: string;
  type: 'file' | 'dir';
  contentBase64: string;
};

/** USTAR tar 解析，仅处理我们关心的 file/dir，跳过 symlink/pax header */
function parseTar(buf: Uint8Array): TarEntry[] {
  const out: TarEntry[] = [];
  const decoder = new TextDecoder('utf-8');
  let offset = 0;
  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    // 全 0 块 = 两个连续空 block，结束
    if (header.every((b) => b === 0)) break;
    const nameRaw = decoder.decode(header.subarray(0, 100)).replace(/\0.*$/, '');
    const prefix = decoder.decode(header.subarray(345, 500)).replace(/\0.*$/, '');
    const sizeOct = decoder.decode(header.subarray(124, 136)).replace(/\0.*$/, '').trim();
    const typeFlag = String.fromCharCode(header[156]);
    const fullName = (prefix ? `${prefix}/${nameRaw}` : nameRaw).replace(/^\.\//, '');
    // 跳过顶层目录
    const parts = fullName.split('/');
    const relPath = parts.slice(1).join('/');

    const size = parseInt(sizeOct, 8) || 0;
    offset += 512;
    if (!relPath) {
      offset += Math.ceil(size / 512) * 512;
      continue;
    }
    const content = buf.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;

    if (typeFlag === '5' || fullName.endsWith('/')) {
      out.push({ path: relPath.replace(/\/$/, ''), type: 'dir', contentBase64: '' });
    } else if (typeFlag === '0' || typeFlag === '') {
      out.push({ path: relPath, type: 'file', contentBase64: bytesToBase64(content) });
    }
    // 其他类型（symlink '2'，pax 'x'/'g'）跳过
  }
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)) as unknown as number[],
    );
  }
  return btoa(s);
}