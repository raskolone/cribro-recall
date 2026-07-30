import { createApp } from '../server';

let appInstance: any;

export default async function handler(req: any, res: any) {
  if (!appInstance) {
    appInstance = await createApp();
  }
  return appInstance(req, res);
}
