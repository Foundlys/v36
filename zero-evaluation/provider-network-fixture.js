'use strict';
// Completes the explicitly mocked provider transport with deterministic public
// DNS. It does not replace URL validation or any authorization/business policy.
const dns=require('node:dns').promises;
const lookup=dns.lookup.bind(dns);
dns.lookup=async(host,options)=>['api.openai.com','calendar-language.fixture.invalid','workflow-language.fixture.invalid'].includes(String(host))
  ? options?.all?[{address:'93.184.216.34',family:4}]:{address:'93.184.216.34',family:4}
  :lookup(host,options);
