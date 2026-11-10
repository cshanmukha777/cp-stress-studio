const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../electron/database/db');
test('CRUD for all collections and restart persistence',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp-db-'));const file=path.join(dir,'studio.sqlite');let db=createDatabase(file);
 try {for(const collection of ['workspaces','tests','history','counterexamples']) {const row=db.save(collection,{name:'example',data:{input:'1\n'}});assert.equal(db.list(collection).length,1);db.save(collection,{...row,name:'updated'});assert.equal(db.get(collection,row.id).name,'updated');}
 db.close();db=createDatabase(file);assert.equal(db.list('tests')[0].data.input,'1\n');const row=db.list('tests')[0];assert.equal(db.remove('tests',row.id),true);assert.equal(db.get('tests',row.id),null);
 assert.throws(()=>db.list('bad'));assert.throws(()=>db.save('tests',{name:'',data:{}}));
 }finally {db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
