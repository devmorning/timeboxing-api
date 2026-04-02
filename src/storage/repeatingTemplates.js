const { hasPostgresConfig } = require("../lib/pgConfig");
const { createMemoryRepeatingTemplatesRepo } = require("./repeatingTemplates.memory");
const { createPostgresRepeatingTemplatesRepo } = require("./repeatingTemplates.postgres");

function createRepeatingTemplatesRepo() {
  if (!hasPostgresConfig()) {
    return createMemoryRepeatingTemplatesRepo();
  }
  return createPostgresRepeatingTemplatesRepo();
}

module.exports = { createRepeatingTemplatesRepo };
