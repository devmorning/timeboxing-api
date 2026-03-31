const { hasPostgresConfig } = require("../lib/pgConfig");
const { createMemoryDayPlansRepo } = require("./repo.memory");
const { createPostgresDayPlansRepo } = require("./repo.postgres");

function createDayPlansRepo() {
  if (!hasPostgresConfig()) {
    return createMemoryDayPlansRepo();
  }
  return createPostgresDayPlansRepo();
}

module.exports = { createDayPlansRepo };
