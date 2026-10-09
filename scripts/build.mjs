import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
const bundle=await build({entryPoints:['src/app.js'],bundle:true,minify:true,format:'iife',target:['es2022'],write:false,legalComments:'inline'});
const css=await readFile('src/style.css','utf8');
const page=await readFile('src/page.html','utf8');
const script=bundle.outputFiles[0].text.replaceAll('</script','<\\/script');
await writeFile('index.html',page.replace('__STYLE__',()=>css).replace('__SCRIPT__',()=>script));
console.log('Built index.html: fully self-contained, no external assets.');
