import * as FileSystem from 'expo-file-system';
import type { DocumentPickerAsset } from 'expo-document-picker';

// nanoid 依赖 `crypto.getRandomValues()`，但 RN 0.76 + bridgeless 模式下
// Hermes 不暴露 `crypto` 全局，导致 'Property crypto doesn't exist'。
// 缓存目录 id 不需要密码学强度，用 Math.random 自造 8 位 id 就够。
function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export type ImportProgress = (stage: 'copy', p: number, msg: string) => void;

/**
 * 把一组 DocumentPicker 选出来的 markdown 文件合成一个"虚拟仓库"，
 * 写到 cacheDirectory/local-imports/<id>/ 下，结构与从 GitHub 下载的
 * tarball 完全一致，下游 fileTree / readText 不需要任何分支判断。
 *
 * 设计要点：
 *   - 多选文件可能来自不同目录。我们用"原始路径的 dirname"作为子目录。
 *     例如选了 "docs/intro.md" 和 "README.md"，就在缓存里建 docs/intro.md + README.md
 *   - 对 content:// URI（Android SAF），copyToCacheDirectory 已经复制到了
 *     本地 cache 目录，uri 可直接用 FileSystem.readAsStringAsync 读。
 *     我们再 read 出来 → write 到目标路径，最终产物是纯本地路径，
 *     reader 端走 readRepoRoot → readText 不需要 content:// 兼容。
 *   - 自动推断 displayName：优先取首个文件名剥后缀、多个取公共目录名。
 */
export async function importLocalFiles(
  assets: DocumentPickerAsset[],
  onProgress?: ImportProgress,
): Promise<{
  rootPath: string;
  displayName: string;
  fileCount: number;
}> {
  if (assets.length === 0) throw new Error('No files selected');

  const id = makeId();
  const root = `${FileSystem.cacheDirectory}local-imports/${id}`;
  await FileSystem.makeDirectoryAsync(root, { intermediates: true });

  // 推断展示名
  const displayName = inferDisplayName(assets);
  onProgress?.('copy', 0, `Preparing ${assets.length} file${assets.length === 1 ? '' : 's'}…`);

  // 同名文件冲突计数器：basename → count
  const seen = new Map<string, number>();

  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    const relPath = makeRelPath(a, seen);
    const dest = `${root}/${relPath}`;
    await FileSystem.makeDirectoryAsync(dest.replace(/\/[^/]+$/, ''), { intermediates: true });

    // 读源文件内容，写到目标
    // expo-file-system 18.x: readAsStringAsync 必须传 file:// URI，不能剥协议
    // picker (copyToCacheDirectory: true) 返回的就是 file:// 指向 cache 副本
    let content: string;
    try {
      content = await FileSystem.readAsStringAsync(a.uri, { encoding: 'utf8' });
    } catch (err) {
      // 退路：expo-file-system v18+ 在某些 Android content provider URI 上可能失败，
      // 试一下把 file:// 剥掉当纯路径用（旧版兼容）
      const fallback = a.uri.replace(/^file:\/\//, '');
      try {
        content = await FileSystem.readAsStringAsync(fallback, { encoding: 'utf8' });
      } catch {
        throw new Error(`Cannot read ${a.name} (${a.uri}): ${(err as Error).message}`);
      }
    }
    await FileSystem.writeAsStringAsync(dest, content, { encoding: 'utf8' });

    onProgress?.('copy', (i + 1) / assets.length, `${i + 1} / ${assets.length} · ${a.name}`);
  }

  return { rootPath: root, displayName, fileCount: assets.length };
}

function inferDisplayName(assets: DocumentPickerAsset[]): string {
  if (assets.length === 1) {
    return assets[0].name.replace(/\.(md|markdown|mdx)$/i, '');
  }
  // 多个文件：取它们共同的最浅目录名
  const dirs = assets
    .map((a) => {
      // 优先从 name 推断（DocumentPicker 给的是 basename，看不到完整路径）
      // 退路：basename 的第一段当目录
      const m = a.name.match(/^([^/]+)\//);
      return m ? m[1] : '';
    })
    .filter(Boolean);
  if (dirs.length > 0 && dirs.every((d) => d === dirs[0])) {
    return dirs[0];
  }
  return `Local · ${assets.length} files`;
}

function makeRelPath(a: DocumentPickerAsset, seen: Map<string, number>): string {
  // basename
  const base = a.name.replace(/^\/+/, '');
  const key = base;
  const count = seen.get(key) ?? 0;
  seen.set(key, count + 1);
  if (count === 0) return base;
  // 加 (n) 后缀避免覆盖
  const dot = base.lastIndexOf('.');
  if (dot < 0) return `${base} (${count + 1})`;
  return `${base.slice(0, dot)} (${count + 1})${base.slice(dot)}`;
}