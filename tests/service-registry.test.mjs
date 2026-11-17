import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const registry=JSON.parse(fs.readFileSync(path.join(root,'config','service-registry.json'),'utf8'));

test('service registry has explicit preview and production routing',()=>{
  assert.ok(registry.service_id);
  assert.ok(registry.cloudflare_profile);
  assert.ok(registry.account_id_env.startsWith('CF_'));
  assert.ok(registry.api_token_env.startsWith('CF_'));
  assert.ok(registry.projects.preview);
  assert.ok(registry.projects.production);
  assert.notEqual(registry.projects.preview,registry.projects.production);
  assert.equal(registry.environments.preview.billing_mode,'test');
  assert.equal(registry.environments.production.billing_mode,'live');
});

test('registry stores secret references, never secret values',()=>{
  const text=JSON.stringify(registry);
  for(const forbidden of [/sk_live_/i,/sk_test_/i,/whsec_/i,/Bearer\s+[A-Za-z0-9._-]{10,}/i]){
    assert.equal(forbidden.test(text),false);
  }
  for(const entry of registry.runtime_secret_map){
    assert.ok(entry.target);
    assert.ok(entry.preview_source);
    assert.ok(entry.production_source);
  }
});

test('central secret template contains both TEST and LIVE profiles',()=>{
  const text=fs.readFileSync(path.join(root,'.env.master.example'),'utf8');
  assert.match(text,/CF_DEMANDSCOPE_ACCOUNT_ID=/);
  assert.match(text,/CF_DEMANDSCOPE_API_TOKEN=/);
  assert.match(text,/STRIPE_DEMANDSCOPE_TEST_SECRET_KEY=/);
  assert.match(text,/STRIPE_DEMANDSCOPE_LIVE_SECRET_KEY=/);
  assert.match(text,/STRIPE_DEMANDSCOPE_TEST_WEBHOOK_SECRET=/);
  assert.match(text,/STRIPE_DEMANDSCOPE_LIVE_WEBHOOK_SECRET=/);
});

test('gitignore blocks generated env and dev-vars files',()=>{
  const text=fs.readFileSync(path.join(root,'.gitignore'),'utf8');
  assert.match(text,/^\.env\.\*/m);
  assert.match(text,/^\.dev\.vars\.\*/m);
  assert.match(text,/^!\.env\.master\.example/m);
});
