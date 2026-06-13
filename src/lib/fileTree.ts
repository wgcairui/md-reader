import * as FileSystem from 'expo-file-system';
import type { FileNode, Repo } from '../types';

/**
 * 把任意 file:// URI 解析成"可以在本地读到的根目录"。
 *
 * DocumentPicker 给的 URI 在 Android 11+ 通常是 content://，
 * 我们通过 Storage Access Framework 的可复制模式拿到真实目录路径。
 * 简化策略：让 picker 直接给我们 tree URI，然后走 SAF 接口读取。
 *
 * 但 expo-document-picker 当前不直接暴露 SAF tree 模式，
 * 所以这里采用"单文件 + 复制到缓存目录"的兜底：
 * 用户选 repo 的根目录时，让他们从文件管理器选 README.md，
 * 然后我们向上找最近的已知 README / index.md 来推断结构。
 *
 * 实际我们走的是更简单的策略：选 *文件夹* 而不是单文件。
 * DocumentPicker 的 pickDirectory 是非官方支持的，
 * 我们改用 Expo 的 intent-based "OpenDocumentTree" via community 插件，
 * 这里先留接口。
 */
export async function readRepoRoot(repo: Repo): Promise<string> {
  if (repo.source.kind === 'local') {
    return repo.source.rootPath;
  }
  // remote
  const dir = `${FileSystem.cacheDirectory}repos/${repo.source.cacheSlug}/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) throw new Error('Remote repo cache missing');
  return dir;
}

/** 列出目录下的所有 .md / .markdown / .mdx 文件（递归） */
export async function listMarkdownFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  await walk(root, root, out);
  return out.sort();
}

async function walk(root: string, dir: string, out: string[]): Promise<void> {
  const entries = await FileSystem.readDirectoryAsync(dir);
  // 先目录后文件，目录按字母序
  entries.sort((a, b) => a.localeCompare(b));
  for (const name of entries) {
    if (name.startsWith('.')) continue;
    if (name === 'node_modules' || name === '.git') continue;
    const full = `${dir}/${name}`;
    const info = await FileSystem.getInfoAsync(full, { size: false });
    if (!info.exists) continue;
    if (info.isDirectory) {
      await walk(root, full, out);
    } else if (/\.(md|markdown|mdx)$/i.test(name)) {
      out.push(full.slice(root.length + 1));
    }
  }
}

/** 构建文件树（用于左侧 sidebar） */
export async function buildFileTree(root: string, displayName?: string): Promise<FileNode> {
  const name = displayName ?? root.split('/').filter(Boolean).pop() ?? 'root';
  const rootNode: FileNode = { name, path: '', isDir: true, children: [] };
  await buildInto(root, root, rootNode);
  sortTree(rootNode);
  return rootNode;
}

async function buildInto(root: string, dir: string, parent: FileNode): Promise<void> {
  const entries = await FileSystem.readDirectoryAsync(dir).catch(() => []);
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = `${dir}/${entry}`;
    const info = await FileSystem.getInfoAsync(full, { size: false });
    if (!info.exists) continue;
    const rel = full.slice(root.length + 1);
    if (info.isDirectory) {
      const node: FileNode = { name: entry, path: rel, isDir: true, children: [] };
      parent.children!.push(node);
      await buildInto(root, full, node);
    } else {
      parent.children!.push({
        name: entry,
        path: rel,
        isDir: false,
        size: (info as { size?: number }).size,
      });
    }
  }
}

function sortTree(node: FileNode): void {
  if (!node.children) return;
  node.children.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const c of node.children) sortTree(c);
}

export async function readText(absPath: string): Promise<string> {
  return FileSystem.readAsStringAsync(absPath, { encoding: 'utf8' });
}