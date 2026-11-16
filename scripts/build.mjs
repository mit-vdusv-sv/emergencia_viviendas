import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url);const out=new URL('dist/',root);
await fs.mkdir(out,{recursive:true});
for(const file of ['index.html','styles.css','app.mjs'])await fs.copyFile(new URL(file,root),new URL(file,out));
for(const folder of ['assets','src','data'])await fs.cp(new URL(folder,root),new URL(folder,out),{recursive:true});
await fs.writeFile(new URL('.nojekyll',out),'');console.log('Vista estática preparada en dist/. Incluye las últimas copias locales.');
