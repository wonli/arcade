import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(webRoot, '..')
const pbjs = path.join(webRoot, 'node_modules', '.bin', 'pbjs')
const proto = path.join(repoRoot, 'proto', 'dungeon.proto')
const output = path.join(webRoot, 'src', 'lib', 'ws', 'dungeon-proto.generated.js')

execFileSync(pbjs, [
  '-t', 'static-module',
  '-w', 'es6',
  '--es6',
  '--dependency', 'protobufjs/minimal.js',
  '-o', output,
  proto,
], { cwd: repoRoot, stdio: 'inherit' })

const generated = readFileSync(output, 'utf8')
writeFileSync(output, generated.replace(
  'import * as $protobuf from "protobufjs/minimal.js";',
  'import $protobuf from "protobufjs/minimal.js";',
))
