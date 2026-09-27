'use strict';
require('./zero-evaluation/sales-sequence-controls').run(false).catch(error=>{console.error(error);process.exitCode=1;});
