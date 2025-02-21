import { merge, uniq } from 'es-toolkit';
import { readFileSync } from 'fs';
import { sync } from 'glob';
import { basename, extname } from 'path';

export type QueryLoaderConfig = {
  /** List of paths to scan for sql templates */
  templates: string[];

  /** List of paths to scan for sql fragments */
  fragments: string[];
};

export const defaultConfig: QueryLoaderConfig = {
  templates: [],
  fragments: [],
};

const particles = {
  template: '.template',
  fragment: '.fragment',
};

/**
 * To Consider:
 *  - Implement naming strategies
 */
export class QueryLoader<T extends string, F extends string> {
  private templatePaths = new Map<T, string>();
  private fragmentPaths = new Map<F, string>();

  private templates = new Map<T, string>();
  private fragments = new Map<F, string>();

  constructor(config: Partial<QueryLoaderConfig> = {}) {
    const cfg = merge(defaultConfig, config);

    this.validateConfig(cfg);
    this.scanFolders(cfg);
  }

  get templatesCount() {
    return this.templatePaths.size;
  }

  get fragmentsCount() {
    return this.fragmentPaths.size;
  }

  hasTemplate(templateName: T) {
    return this.templatePaths.has(templateName);
  }

  hasFragment(fragmentName: F) {
    return this.fragmentPaths.has(fragmentName);
  }

  getTemplate(templateName: T) {
    if (!this.templatePaths.has(templateName)) {
      throw new Error(`Template "${templateName}" not found`);
    }

    if (this.templates.has(templateName)) {
      return this.templates.get(templateName);
    }

    const filePath = this.templatePaths.get(templateName)!;
    const templateStr = readFileSync(filePath, { encoding: 'utf-8' });

    this.templates.set(templateName, templateStr);

    return templateStr;
  }

  getFragment(fragmentName: F) {
    if (!this.fragmentPaths.has(fragmentName)) {
      throw new Error(`Template "${fragmentName}" not found`);
    }

    if (this.fragments.has(fragmentName)) {
      return this.fragments.get(fragmentName);
    }

    const filePath = this.fragmentPaths.get(fragmentName)!;
    const templateStr = readFileSync(filePath, { encoding: 'utf-8' });

    this.fragments.set(fragmentName, templateStr);

    return templateStr;
  }

  private scanFolders(config: QueryLoaderConfig) {
    if (config.templates.length === 0 && config.fragments.length === 0) return;

    const paths = uniq([...config.templates, ...config.fragments]);
    const files = sync(paths);

    files.forEach((file) => {
      const fileName = basename(file, extname(file));
      const isFragment = fileName.match(particles.fragment);

      if (isFragment) {
        const fragmentName = fileName.replace(particles.fragment, '') as F;
        this.fragmentPaths.set(fragmentName, file);

        return;
      }

      const templateName = fileName.replace(particles.template, '') as T;
      this.templatePaths.set(templateName, file);
    });
  }

  private validateConfig(config: QueryLoaderConfig) {
    config.templates.forEach((path) => {
      const hasCorrectIdentifier = path.includes(particles.template + '.');

      if (hasCorrectIdentifier) {
        return;
      }

      throw new Error('Incorrect template path!', {
        cause:
          'A template file name should include the ".template" in it. E.g. "my-query.template.sql"',
      });
    });

    config.fragments.forEach((path) => {
      const hasCorrectIdentifier = path.includes(particles.fragment + '.');

      if (hasCorrectIdentifier) {
        return;
      }

      throw new Error('Incorrect fragment path!', {
        cause:
          'A fragment file name should include the ".fragment" in it. E.g. "my-fragment.fragment.sql"',
      });
    });
  }
}
