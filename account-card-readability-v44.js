(function(){
'use strict';
if(window.__JJOONI_ACCOUNT_CARD_READABILITY_V44)return;
window.__JJOONI_ACCOUNT_CARD_READABILITY_V44={state:'BOOTING',version:'44.0'};
function install(){
 if(document.getElementById('ctAccountCardReadabilityV44Style'))return;
 const s=document.createElement('style');
 s.id='ctAccountCardReadabilityV44Style';
 s.textContent=`
/* Readability V44: the account cards visible in the tablet/large-screen Overview
   must remain readable even when the browser reports a fine pointer. */
@media (min-width:1100px) and (max-width:1800px){
 #overviewAccounts .ctAcct,
 .ctOvAccounts .ctAcct,
 #panel-performance .ctP8Card,
 #panel-accounts .ctA8Card{
   font-size:18px!important;
   line-height:1.5!important;
 }
 #overviewAccounts .ctAcct *,
 .ctOvAccounts .ctAcct *{
   font-size:18px!important;
   line-height:1.5!important;
 }
 #overviewAccounts .ctAcctName,
 .ctOvAccounts .ctAcctName,
 #panel-performance .ctP8Name,
 #panel-accounts .ctA8Name{
   font-size:20px!important;
   line-height:1.35!important;
   font-weight:900!important;
 }
 #overviewAccounts .ctAcctNav,
 .ctOvAccounts .ctAcctNav,
 #panel-performance .ctP8Nav,
 #panel-accounts .ctA8Nav{
   font-size:22px!important;
   line-height:1.25!important;
   font-weight:900!important;
 }
 #overviewAccounts .ctAcctStats,
 #overviewAccounts .ctAcctStats span,
 #overviewAccounts .ctAcctStats b,
 .ctOvAccounts .ctAcctStats,
 .ctOvAccounts .ctAcctStats span,
 .ctOvAccounts .ctAcctStats b,
 #overviewAccounts .ctHumanAccountLineV6,
 .ctOvAccounts .ctHumanAccountLineV6,
 #panel-performance .ctP8Line,
 #panel-performance .ctP8Line span,
 #panel-performance .ctP8Line b,
 #panel-accounts .ctA8Line,
 #panel-accounts .ctA8Line span,
 #panel-accounts .ctA8Line b{
   font-size:18px!important;
   line-height:1.5!important;
 }
 #overviewAccounts .gain,#overviewAccounts .loss,
 .ctOvAccounts .gain,.ctOvAccounts .loss,
 #panel-performance .gain,#panel-performance .loss,
 #panel-accounts .gain,#panel-accounts .loss{
   font-size:20px!important;
   font-weight:900!important;
 }
 #overviewAccounts .ctAcct,
 .ctOvAccounts .ctAcct{
   padding:18px!important;
 }
 #overviewAccounts .ctAcctStats,
 .ctOvAccounts .ctAcctStats{
   row-gap:8px!important;
   column-gap:12px!important;
 }
 #overviewAccounts .ctAcctSpark svg text,
 .ctOvAccounts .ctAcctSpark svg text{
   font-size:16px!important;
 }
 #panel-performance .ctP8Source,
 #panel-accounts .ctA8Source{
   font-size:16px!important;
   line-height:1.45!important;
 }
}
`;
 (document.head||document.documentElement).appendChild(s);
 window.__JJOONI_ACCOUNT_CARD_READABILITY_V44={state:'ACTIVE',version:'44.0',body_floor_px:18,title_px:20,nav_px:22,accent_px:20};
}
install();
})();
