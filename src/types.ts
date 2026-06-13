/**
 * 仓库元数据类型
 *
 * sourceKind:
 *   - 'local': 用户在平板上挑了一组 markdown 文件（多选），app 在缓存里
 *              合成一个虚拟目录作为仓库根。displayName 通常来自用户输入
 *              或自动推断（取首个文件所在子目录）。
 *   - 'remote': 从 GitHub URL 通过 tarball API 下载解压
 */
export type RepoSource =
  | {
      kind: 'local';
      /** 缓存中虚拟仓库根目录的绝对路径（无 file:// 前缀） */
      rootPath: string;
      /** 用户可见的仓库名 */
      displayName: string;
      /** 创建时间，用于在 UI 标注"本地导入" */
      importedAt: number;
      /** 文件总数，方便 UI 提示 */
      fileCount: number;
    }
  | {
      kind: 'remote';
      url: string;
      owner: string;
      name: string;
      /** 缓存目录，相对 app 文件根 */
      cacheSlug: string;
    };

export type Repo = {
  id: string;
  addedAt: number;
  lastOpenedAt: number;
  source: RepoSource;
};

export type FileNode = {
  name: string;
  /** 相对仓库根 */
  path: string;
  isDir: boolean;
  children?: FileNode[];
  size?: number;
};

export type MarkdownMeta = {
  headings: { depth: number; text: string; id: string }[];
  siblingMarkdowns: string[];
  currentPath: string;
};