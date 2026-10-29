import 'reflect-metadata';

import { DataSource } from 'typeorm';

import { getDatabaseUrl } from '../config/environment';
import { createDataSourceOptions } from './data-source-options';

export default new DataSource(createDataSourceOptions(getDatabaseUrl()));
