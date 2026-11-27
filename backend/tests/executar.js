/**
 * Executa todos os testes (unitários + integrados) em sequência, funcionando também no Windows.
 * Os testes integrados usam o banco separado DB_NAME_TEST (apagado e recriado a cada execução).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const pasta = __dirname;
const arquivos = [
  path.join(pasta, 'regras.test.js'),
  ...fs
    .readdirSync(path.join(pasta, 'integracao'))
    .filter((f) => f.endsWith('.test.js'))
    .sort()
    .map((f) => path.join(pasta, 'integracao', f)),
];

const resultado = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...arquivos], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'test' },
});
process.exit(resultado.status ?? 1);
