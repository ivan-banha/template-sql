import { describe, expect, test } from '@jest/globals';
import exp from 'constants';

import { QueryLoader } from '../../src/query-loader.js';

const queryTemplates = {
  simpleQuery:
    'SELECT * FROM videos WHERE id = {{ id }} AND alias = {{ alias }};',
};

const queries = {
  simpleQuery: 'simple-query',
  conditionalQuery: 'conditional-query',
};

describe('Query Loader', () => {
  test('Do not detect any files with empty "templates"', () => {
    const loader = new QueryLoader({
      templates: [],
    });

    expect(loader.filesCount).toBe(0);
  });

  test('Detects all queries in a folder and its subfolders', () => {
    const loader = new QueryLoader({
      templates: ['tests/query-loader/**/*.sql'],
    });

    expect(loader.filesCount).toBe(2);
  });

  test('Find all queries in specified folders', () => {
    const loader = new QueryLoader({
      templates: [
        'tests/templates/simple/*.sql',
        'tests/templates/conditional/*.sql',
      ],
    });

    expect(loader.filesCount).toBe(2);
  });

  test('Loads query from FS', () => {
    const loader = new QueryLoader({
      templates: [
        'tests/templates/simple/*.sql',
        'tests/templates/conditional/*.sql',
      ],
    });

    expect(loader.hasTemplate(queries.simpleQuery)).toBeTruthy();

    const templateStr = loader.getTemplate(queries.simpleQuery);

    expect(templateStr).toBe(queryTemplates.simpleQuery);
  });
});
