type ProcessorFn = (
  sql: string,
  params: unknown[],
  context: RawQueryBuilder,
) => [string, unknown[]];

type NamedParams = Record<string, unknown>;

const Regex = {
  variable: /\{\{\s*([^#]+?)\s*\}\}/g,
  fragment: /\{\{\s*#\s*([^}]+)\}\}/g,
  orLoop: /{{#or_loop (\w+)}}([\s\S]*?){{\/or_loop}}/g,
  loopId: /\{\{\s*id\s*\}\}/,
};

function genFallbackKey(key: string) {
  return `${key}_fallback`;
}

export class RawQueryBuilder {
  private pipeline: ProcessorFn[] = [];
  private sqlFragments: Record<string, string> = {};
  private sql: string = '';

  private namedParams: NamedParams = {};

  constructor() {
    this.pipeline = [replaceOrLoops, replaceFragments, replaceParams];
  }

  addFragment(key: string, sql: string, fallbackSql?: string): RawQueryBuilder {
    key = key.trim();
    sql = sql.trim();

    this.sqlFragments[key] = sql;

    if (fallbackSql) {
      fallbackSql = fallbackSql.trim();
      this.sqlFragments[genFallbackKey(key)] = fallbackSql;
    }

    return this;
  }

  setSql(sql: string) {
    this.sql = sql.trim();

    return this;
  }

  addParams(params: NamedParams = {}) {
    this.namedParams = Object.assign(this.namedParams, params);

    return this;
  }

  getParamValue<T = unknown>(paramName: string): T {
    return this.namedParams[paramName] as T;
  }

  getFragmentSQL(fragmentName: string) {
    return this.sqlFragments[fragmentName];
  }

  getFallbackFragmentSQL(fragmentName: string) {
    const fallbackKey = genFallbackKey(fragmentName);

    return this.getFragmentSQL(fallbackKey);
  }

  build(): [string, unknown[]] {
    const [sql, params] = this.pipeline.reduce(
      ([sql, params], processorFn) => processorFn(sql, params, this),
      [this.sql, [] as unknown[]],
    );

    return [sql, params];
  }
}

const replaceFragments: ProcessorFn = (sql, params, ctx) => {
  sql = sql.replace(Regex.fragment, (_match, value) => {
    const fragmentName = value.trim();

    if (!fragmentName) {
      throw new Error(`Fragment name is not valid! ${_match}`);
    }

    const fragmentSql = ctx.getFragmentSQL(fragmentName);

    return fragmentSql;
  });

  return [sql, params];
};

const replaceOrLoops: ProcessorFn = (sql, params, context) => {
  sql = sql.replace(Regex.orLoop, (_match, arrayName, fragment) => {
    arrayName = arrayName.trim();
    if (!arrayName) {
      throw new Error(`Iterator's array name is not valid! ${_match}`);
    }

    fragment = fragment.trim();
    if (!fragment) {
      throw new Error(`Iterator's fragment name is not valid! ${_match}`);
    }

    const arrayValues = context.getParamValue<unknown[]>(arrayName);
    const isFragment = fragment.at(0) === '#';

    if (arrayValues.length === 0) {
      const fallbackSql = context.getFallbackFragmentSQL(
        fragment.replace('#', ''),
      );

      return fallbackSql || 'TRUE = TRUE';
    }

    const fragmentSql: string = isFragment
      ? context.getFragmentSQL(fragment.replace('#', ''))
      : fragment;

    const SQLs = arrayValues.map((value, i) => {
      const namedKey = `${arrayName}-${i}`;
      context.addParams({ [namedKey]: value });
      let subKeyCounter = 0;

      // return fragmentSql.replace(Regex.loopId, `{{ ${namedKey} }}`);
      return fragmentSql.replace(Regex.variable, (_match, key) => {
        const paramName = key.trim();

        if (!paramName) {
          throw new Error(`Loop param name is not specified! ${_match}`);
        }

        if (paramName !== 'id') {
          console.log('Skip not iterative variable');
          return `{{ ${paramName} }}`;
        }

        const subKey = `${namedKey}_${subKeyCounter}`;
        subKeyCounter++;

        context.addParams({ [subKey]: value });

        return `{{ ${subKey} }}`;
      });
    });

    return SQLs.join(' OR ');
  });

  return [sql, params];
};

const replaceParams: ProcessorFn = (sql, params, ctx) => {
  sql = sql.replace(Regex.variable, (_match, value, ...rest) => {
    const paramName = value.trim();

    if (!paramName) {
      throw new Error(`Param name is not specified! ${_match}`);
    }

    const key = '$' + (params.length + 1).toString();
    const paramValue = ctx.getParamValue(paramName);

    if (!paramValue) {
      console.error('No param');
    }

    params.push(paramValue);

    return key;
  });

  return [sql, params];
};
