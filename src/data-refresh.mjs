export const SOURCE_NAMES=['housing','alerts','ocean','erfen','exposure'];

export function preferNewest(current,incoming){
 if(!current)return incoming;
 if(!incoming)return current;
 return Date.parse(current.source?.retrievedAt)>Date.parse(incoming.source?.retrievedAt)?current:incoming;
}

export async function readDataset(name,{local=false,fetcher=globalThis.fetch}={}){
 if(!SOURCE_NAMES.includes(name))throw new Error('Fuente desconocida.');
 const url=local?`api/${name}`:`data/${name}.json`;
 const response=await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(local?45000:15000)});
 if(!response.ok)throw new Error(`La fuente respondió HTTP ${response.status}.`);
 const data=await response.json();
 const valid=data&&Number.isFinite(Date.parse(data.source?.retrievedAt))&&(
  name==='housing'?Array.isArray(data.records)&&data.records.length===24:
  name==='alerts'||name==='ocean'?Array.isArray(data.records):
  name==='erfen'?Boolean(data.latest?.url):Array.isArray(data.layers));
 if(!valid)throw new Error('La fuente no devolvió una copia válida.');
 return data;
}
