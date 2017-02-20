#!/usr/bin/env node

// TODO: this script sucks; usage on empty, actual validation, ect.

const fs = require('fs');
const path = require('path');

const program = require('commander');

const slsperf = require(path.join(__dirname, '..'));

let config = {
  provider: {},
  function: {},
  test: {}
};

let latencyTest = {
  type: 'latency',
  delay: 60000,
  delayIncrease: 60000,
  maxDelay: 1800000
};

let throughputTest = {
  type: 'throughput',
  width: 15,
  duration: 10000,
};

program
  .usage('[options] <resultsDir>')
  .option(
    '-p, --provider <name>',
    'Serverless platform to target (amazon, ibm, microsoft, google)',
    name => config.provider.name = name)
  .option(
    '--project <name>',
    'Name of the project to deploy Google Cloud Functions to',
    name => config.provider.project = name)
  .option(
    '--credentials <path>',
    'Path of the file holding Google Cloud credentials',
    path => config.provider.credentials = path)
  .option(
    '-d, --duration <ms>',
    'Number of milliseconds the function should execute before returning',
    ms => config.function.duration = parseInt(ms))
  .option(
    '-l, --latency',
    'Runs a latency test on the specified provider',
    () => config.test = latencyTest)
  .option(
    '-t, --throughput',
    'Runs a throughput test on the specified provider',
    () => config.test = throughputTest)
  .option(
    '-i, --iterations <n>',
    'Number of times to run the test',
    n => config.test.iterations = parseInt(n))
  .parse(process.argv);

config.resultsDir = program.args[0];

if (!fs.existsSync(config.resultsDir)) {
  fs.mkdirSync(config.resultsDir);
}

fs.writeFileSync(path.join(config.resultsDir, `${config.provider.name}_${config.test.type}_config.json`))

let iteration = 0;
fs.readdirSync(config.resultsDir).forEach(file => {
  if (file.match(/[a-z]+_[a-z]+_[0-9]+\.json/) != null) {
    let left = file.split('.')[0].split('_');
    if (left[0] == config.provider.name && left[1] == config.test.type) {
      let iterationFound = parseInt(left[2]);
      if (iterationFound >= iteration) {
        console.log(`Iteration ${iterationFound} already complete`);
        iteration = iterationFound + 1;
      }
    }
  }
});

if (iteration < config.test.iterations) {
  console.log(`Starting iteration ${iteration}`);
  slsperf.run(config, false, function processOutput(output) {
    let outputFile = path.join(config.resultsDir, `${config.provider.name}_${config.test.type}_${iteration}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 4));
    console.log(`Finished iteration ${iteration}`);
    if (++iteration < config.test.iterations) {
      console.log(`Starting iteration ${iteration}`);
      slsperf.run(config, true, processOutput);
    }
  });
}
