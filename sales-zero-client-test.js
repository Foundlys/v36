'use strict';
require('./zero-evaluation/sales-sequence-controls').run(true).catch(error=>{console.error(error);process.exitCode=1;});
