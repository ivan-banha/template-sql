import { describe, expect, test } from '@jest/globals';
import { join } from 'path';

import { QueryLoader } from '../../src/query-loader.js';

const queryTemplates = {
  simpleQuery:
    'SELECT * FROM videos WHERE id = {{ id }} AND alias = {{ alias }};',
};

const queries = {
  simpleQuery: 'simple-query',
  simpleQueryFragment: 'simple',
};

const templateFolderPath = join('tests', 'query-loader', 'templates');

describe('Query Loader', () => {
  test('Do not detect any files with empty config', () => {
    const loader = new QueryLoader();

    expect(loader.templatesCount).toBe(0);
  });

  test('Throws error if path incorrect', () => {
    const throwTemplatesError = () => {
      const loader = new QueryLoader({
        templates: [join('tests', 'query-loader', '**', '*.sql')],
        fragments: [join('tests', 'query-loader', '**', '*.fragment.sql')],
      });
    };

    const throwFragmentsError = () => {
      const loader = new QueryLoader({
        templates: [join('tests', 'query-loader', '**', '*.template.sql')],
        fragments: [join('tests', 'query-loader', '**', '*.sql')],
      });
    };

    expect(throwTemplatesError).toThrowError();
    expect(throwFragmentsError).toThrowError();
  });

  test('Detects templates and fragments in a folder and its subfolders', () => {
    const loader = new QueryLoader({
      templates: [join('tests', 'query-loader', '**', '*.template.sql')],
      fragments: [join('tests', 'query-loader', '**', '*.fragment.sql')],
    });

    expect(loader.templatesCount).toBe(2);
    expect(loader.fragmentsCount).toBe(2);
  });

  test('Find all queries in specified folders', () => {
    const loader = new QueryLoader({
      templates: [
        join(templateFolderPath, 'simple', '*.template.sql'),
        join(templateFolderPath, 'conditional', '*.template.sql'),
      ],
      fragments: [
        join(templateFolderPath, 'simple', '*.fragment.sql'),
        join(templateFolderPath, 'conditional', '*.fragment.sql'),
      ],
    });

    expect(loader.templatesCount).toBe(2);
    expect(loader.fragmentsCount).toBe(2);
  });

  test('Loads query from FS', () => {
    const loader = new QueryLoader({
      templates: [
        join(templateFolderPath, 'simple', '*.template.sql'),
        join(templateFolderPath, 'conditional', '*.template.sql'),
      ],
      fragments: [
        join(templateFolderPath, 'simple', '*.fragment.sql'),
        join(templateFolderPath, 'conditional', '*.fragment.sql'),
      ],
    });

    expect(loader.hasTemplate(queries.simpleQuery)).toBeTruthy();
    expect(loader.hasFragment(queries.simpleQueryFragment)).toBeTruthy();

    const templateStr = loader.getTemplate(queries.simpleQuery);
    expect(templateStr).toBe(queryTemplates.simpleQuery);

    const fragmentStr = loader.getFragment(queries.simpleQueryFragment);
    expect(fragmentStr).toBe(queryTemplates.simpleQuery);
  });
});
