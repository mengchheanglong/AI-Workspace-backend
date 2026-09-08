import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { databaseOptions } from './database-options';

const url = process.env.DATABASE_URL;
if (!url || !/^postgres(?:ql)?:\/\//.test(url)) {
  throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
}

export default new DataSource(databaseOptions(url));
