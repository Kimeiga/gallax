import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const token=process.env.VITE_MAPBOX_TOKEN?.trim();
if(!token?.startsWith('pk.')) {
  throw new Error('Production builds require VITE_MAPBOX_TOKEN with the existing public Mapbox key.');
}
const root=fileURLToPath(new URL('../',import.meta.url));
const child=spawn(process.execPath,[fileURLToPath(new URL('../node_modules/vite/bin/vite.js',import.meta.url)),'build'],{
  cwd:root,env:{...process.env,VITE_MAPBOX_TOKEN:token},stdio:'inherit',
});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
