'use strict';

const fs = require('fs');

const stringify = require('csv-stringify');
const request = require('request');
const uuidV1 = require('uuid/v1');

const providers = require('./providers');

module.exports = function(config) {
  let results = [["times"]];

  for (let i = 0; i < config.test.timings.length; i++) {
    results[i + 1] = [config.test.timings[i]];
  }

  for (let i = 0; i < config.test.iterations; i++) {
    results[0][i + 1] = i;
  }

  let remainingIterations = config.test.iterations;

  providers.prepareConcurrency(config, () => {
    let executeRound = (currentRound) => {
      providers.deploy(config, (uris) => {
        if (uris.length > remainingIterations) {
          uris = uris.slice(0, remainingIterations);
        }

        let remainingInRound = uris.length;

        for (let i = 0; i < uris.length; i++) {
          let remainingInIteration = config.test.timings.length;

          let delay = 3 * config.test.timings.length * config.test.concurrency;
          let start = Date.now() + delay;

          for (let n = 0; n < config.test.timings.length; n++) {
            setTimeout(
              (currentIteration, currentIterationId) => request.post({
                url: uris[i],
                body: JSON.stringify({
                  duration: config.function.duration,
                  id: currentIterationId
                }),
                time: true
              }, (err, res, body) => {
                if (err) throw err;
                if (res.statusCode != 200) {
                  throw new Error('Unexpected response. Status code: ' + res.statusCode + '. Body: ' + body);
                }

                let parsedBody = JSON.parse(body);
                if (parsedBody.id !== currentIterationId) {
                  throw new Error('Function id mismatch in ' + currentIterationId + ': ' + parsedBody.id);
                }

                let overhead = res.elapsedTime - parsedBody.duration;
                console.log(overhead + 'ms');
                results[n + 1][currentIteration + 1] = overhead;

                if (--remainingInIteration == 0) {
                  console.log('Finished iteration ' + currentIteration);

                  if (--remainingIterations == 0) {
                    stringify(results, (err, output) => {
                      if (err) throw err;
                      fs.writeFile(config.resultsFile, output);
                      providers.cleanupDeployment(config);
                    });
                  } else if (--remainingInRound == 0) {
                    executeRound(currentRound + 1);
                  }
                }
              }),
              start + config.test.timings[n] - Date.now(),
              currentRound * config.test.concurrency + i,
              uuidV1()
            );
          }
        }
      });
    };
    executeRound(0);
  });
}
