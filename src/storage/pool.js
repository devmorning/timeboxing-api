const { Pool } = require("pg");
const { getPoolConfig } = require("../lib/pgConfig");

let poolInstance = null;

function getPool() {
  if (poolInstance) return poolInstance;
  poolInstance = new Pool(getPoolConfig());
  return poolInstance;
}

module.exports = { getPool };
