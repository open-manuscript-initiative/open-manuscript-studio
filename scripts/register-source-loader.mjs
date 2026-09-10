import { register } from 'node:module';

register(new URL('./source-loader.mjs', import.meta.url));
