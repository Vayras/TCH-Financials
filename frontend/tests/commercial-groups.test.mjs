import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { QueryClient, QueryObserver } from '@tanstack/react-query';

// Capture the real hook's options without mounting React or calling the API.
const source = readFileSync(new URL('../app/commercial/queries.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const context = { exports: {}, require: (name) => name === '@tanstack/react-query'
  ? { useQuery: (options) => options } : {} };
vm.runInNewContext(compiled, context);

for (const [from, to] of [['creator', 'campaign'], ['campaign', 'creator'], ['campaign', 'campaign'], ['creator', 'creator']]) {
  test(`${from} → ${to}: only reuse compatible group results`, () => {
    const client = new QueryClient();
    const options = (groupBy, page) => ({
      ...context.exports.useCommercialGroupPageQuery({ fyStart: 2026, groupBy, page, pageSize: 12 }),
      queryFn: () => new Promise(() => {}),
    });
    const previous = { items: [{ name: 'Previous group' }], total: 1 };
    const initial = options(from, 1);
    client.setQueryData(initial.queryKey, previous);
    const observer = new QueryObserver(client, initial);
    const unsubscribe = observer.subscribe(() => {});
    try {
      observer.setOptions(options(to, 2));
      const result = observer.getCurrentResult();
      assert.equal(result.data, from === to ? previous : undefined);
      assert.equal(result.isLoading, from !== to);
    } finally {
      unsubscribe();
      client.clear();
    }
  });
}
