import type { Project } from '../types';
import { normalizeProject } from '../defaults';
const DB_NAME = 'frame-words';
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains('projects') ? request.transaction!.objectStore('projects') : db.createObjectStore('projects');
      // Move the v1 single draft atomically; do not discard the user's old work.
      const legacy = store.get('current');
      legacy.onsuccess = () => {
        if (legacy.result) {
          const migrated = normalizeProject(legacy.result);
          store.put(migrated, migrated.id);
          store.delete('current');
        }
      };
    };
    request.onsuccess = () => {
      const db=request.result;
      db.onversionchange=()=>db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('다른 탭의 작업실을 닫고 다시 시도해 주세요.'));
  });
}
async function mutate(action: (store:IDBObjectStore)=>void) {
  const db=await database();
  try {
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('projects','readwrite');
      action(tx.objectStore('projects'));
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  } finally {db.close();}
}
export async function saveProject(project: Project): Promise<Project> {
  const saved={...project,updatedAt:Date.now()};
  await mutate(store=>store.put(saved,saved.id));
  return saved;
}
export async function deleteProject(id:string) { await mutate(store=>store.delete(id)); }
export async function loadProjects():Promise<Project[]> {
  const db=await database();
  try {
    return await new Promise((resolve,reject)=>{
      const request=db.transaction('projects').objectStore('projects').getAll();
      request.onsuccess=()=>resolve(request.result.map(normalizeProject));
      request.onerror=()=>reject(request.error);
    });
  } finally {db.close();}
}
