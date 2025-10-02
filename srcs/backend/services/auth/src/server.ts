// src/server.ts

import {buildServer} from './build.ts';
import dotenv from 'dotenv';
dotenv.config();

const PORT = 3000;

const auth = await buildServer({logger: true});

const start = async () => {
  try {
    await auth.listen({host: '0.0.0.0', port:PORT}, (err, addr) => {
      auth.log.info(`auth server listening on ${addr}`);
    })
  } catch (err) {
    auth.log.error(err);
    process.exit(1);
  }

}
start();
