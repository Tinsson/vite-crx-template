const repositoryOnlyScripts = [
  'build:cli',
  'pack:cli',
  'prepack',
  'changeset',
  'version-packages',
  'release'
]

export function templatePackage(source) {
  const result = JSON.parse(JSON.stringify(source))
  for (const script of repositoryOnlyScripts) delete result.scripts?.[script]
  delete result.devDependencies?.['@changesets/cli']
  return result
}
