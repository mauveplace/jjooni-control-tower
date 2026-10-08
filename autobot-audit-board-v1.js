(function(){
'use strict';
// AUTOBOT was retired from Control Tower on 2026-10-08.
// Keep this compatibility module so older boot loaders do not fail while
// guaranteeing that no audit polling, decryption, rendering, or mutation runs.
window.__JJOONI_AUTOBOT_AUDIT_BOARD_V1={
  state:'RETIRED',
  version:'retired-2026-10-08',
  updated_at:new Date().toISOString(),
  error:null,
  read_only:true,
  production_mutation_allowed:false,
  broker_calls:0
};
})();
