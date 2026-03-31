const { Pool } = require("pg");
const { getPoolConfig } = require("../lib/pgConfig");

const pool = new Pool(getPoolConfig());

module.exports = { pool };
