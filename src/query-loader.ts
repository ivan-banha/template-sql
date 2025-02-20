import { uniq } from 'es-toolkit';
import { readFile, readFileSync } from 'fs';
import * as glob from 'glob';
import * as path from 'path';

export type LoaderConfig = {
  /**
   * List of paths to scan for sql templates
   */
  templates: string[];
};

export const defaultConfig: LoaderConfig = {
  templates: [],
};

/**
 * To Consider:
 *  - Implement naming strategies
 */
export class QueryLoader {
  private filePaths = new Map<string, string>();
  private queries = new Map<string, string>();

  constructor(private config: LoaderConfig = defaultConfig) {
    this.scanTemplates();
  }

  get filesCount() {
    return this.filePaths.size;
  }

  hasTemplate(templateName: string) {
    return this.filePaths.has(templateName);
  }

  getTemplate(templateName: string) {
    if (!this.filePaths.has(templateName)) {
      throw new Error(`Template "${templateName}" not found`);
    }

    if (this.queries.has(templateName)) {
      return this.queries.get(templateName);
    }

    const filePath = this.filePaths.get(templateName)!;
    const templateStr = readFileSync(filePath, { encoding: 'utf-8' });

    this.queries.set(templateName, templateStr);

    return templateStr;
  }

  private scanTemplates() {
    if (this.config.templates.length === 0) return;

    const paths = uniq(this.config.templates);
    const files = glob.sync(paths);

    files.forEach((file) => {
      const fileName = path.basename(file, path.extname(file));

      this.filePaths.set(fileName, file);
    });
  }
}
