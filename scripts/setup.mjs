import {writeFile} from 'node:fs/promises';
const api=process.argv[2],secret=process.env.SETUP_SECRET;
if(!api||!secret){console.error('Usage: SETUP_SECRET=<your-secret> npm run setup -- https://your-service.workers.dev');process.exit(1);}
const url=new URL(api);if(url.protocol!=='https:'){console.error('Use the HTTPS service URL.');process.exit(1);}
const result=await fetch(new URL('/admin/setup',url),{method:'POST',headers:{Authorization:`Bearer ${secret}`}});
const data=await result.json();if(!result.ok){console.error(data.error);process.exit(1);}
await writeFile('private-links.json',JSON.stringify(data.links,null,2)+'\n',{mode:0o600});
console.log('Created private-links.json. Give each player their own link; do not commit or share this file publicly.');
